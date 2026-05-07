import { Router, type IRouter } from "express";
import { eq, and, count, lt, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, projectsTable, projectMembersTable, tasksTable, usersTable, activityTable } from "@workspace/db";
import { CreateProjectBody, UpdateProjectBody, UpdateProjectMemberBody, AddProjectMemberBody } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "./users";

const router: IRouter = Router();

async function getProjectMember(projectId: number, userId: number) {
  const members = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)))
    .limit(1);
  return members[0] || null;
}

async function resolveUser(req: any) {
  const clerkAuth = getAuth(req);
  const email = (clerkAuth as any)?.sessionClaims?.email || "";
  const fullName = (clerkAuth as any)?.sessionClaims?.fullName || (clerkAuth as any)?.sessionClaims?.username || email.split("@")[0];
  return getOrCreateUser(req.clerkId, email, fullName);
}

async function getProjectWithStats(projectId: number, userId: number) {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);

  if (!projects[0]) return null;

  const member = await getProjectMember(projectId, userId);
  if (!member) return null;

  const now = new Date();
  const [totalRes] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, projectId));
  const [completedRes] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, "done")));
  const [overdueRes] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, projectId), lt(tasksTable.dueDate, now), sql`${tasksTable.status} != 'done'`));
  const [memberCountRes] = await db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));

  return {
    ...projects[0],
    totalTasks: totalRes.count,
    completedTasks: completedRes.count,
    overdueTasks: overdueRes.count,
    memberCount: memberCountRes.count,
    myRole: member.role,
  };
}

router.get("/projects", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const results = await Promise.all(
    memberships.map(({ projectId }) => getProjectWithStats(projectId, user.id))
  );

  res.json(results.filter(Boolean));
});

router.post("/projects", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);

  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ name: parsed.data.name, description: parsed.data.description ?? null, ownerId: user.id, status: "active" })
    .returning();

  await db.insert(projectMembersTable).values({ projectId: project.id, userId: user.id, role: "admin" });

  await db.insert(activityTable).values({
    type: "project_created",
    description: `Created project "${project.name}"`,
    projectId: project.id,
    userId: user.id,
  });

  res.status(201).json(project);
});

router.get("/projects/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const result = await getProjectWithStats(projectId, user.id);
  if (!result) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(result);
});

router.patch("/projects/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ ...parsed.data })
    .where(eq(projectsTable.id, projectId))
    .returning();

  res.json(updated);
});

router.delete("/projects/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  res.sendStatus(204);
});

router.get("/projects/:id/members", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const members = await db
    .select({
      id: projectMembersTable.id,
      projectId: projectMembersTable.projectId,
      userId: projectMembersTable.userId,
      role: projectMembersTable.role,
      joinedAt: projectMembersTable.joinedAt,
      user: {
        id: usersTable.id,
        clerkId: usersTable.clerkId,
        email: usersTable.email,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      },
    })
    .from(projectMembersTable)
    .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
    .where(eq(projectMembersTable.projectId, projectId));

  res.json(members.map(m => ({ ...m, user: { ...m.user, avatarUrl: m.user.avatarUrl ?? null } })));
});

router.post("/projects/:id/members", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = AddProjectMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email))
    .limit(1);

  if (!targetUsers[0]) {
    res.status(404).json({ error: "User not found. They must sign up first." });
    return;
  }

  const targetUser = targetUsers[0];
  const existing = await getProjectMember(projectId, targetUser.id);
  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  const [newMember] = await db
    .insert(projectMembersTable)
    .values({ projectId, userId: targetUser.id, role: parsed.data.role })
    .returning();

  await db.insert(activityTable).values({
    type: "member_added",
    description: `Added ${targetUser.name} to project`,
    projectId,
    userId: user.id,
  });

  res.status(201).json({ ...newMember, user: { ...targetUser, avatarUrl: targetUser.avatarUrl ?? null } });
});

router.patch("/projects/:id/members/:userId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);
  const rawUser = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetUserId = parseInt(rawUser, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = UpdateProjectMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(projectMembersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, targetUserId)))
    .returning();

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  res.json({ ...updated, user: { ...targetUser, avatarUrl: targetUser.avatarUrl ?? null } });
});

router.delete("/projects/:id/members/:userId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);
  const rawUser = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetUserId = parseInt(rawUser, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  await db
    .delete(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, targetUserId)));

  res.sendStatus(204);
});

export default router;
