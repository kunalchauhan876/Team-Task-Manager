import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, tasksTable, projectMembersTable, projectsTable, usersTable, activityTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router: IRouter = Router();

async function resolveUser(req: any) {
  const clerkAuth = getAuth(req);
  const email = (clerkAuth as any)?.sessionClaims?.email || "";
  const fullName = (clerkAuth as any)?.sessionClaims?.fullName || (clerkAuth as any)?.sessionClaims?.username || email.split("@")[0];
  return getOrCreateUser(req.clerkId, email, fullName);
}

function buildInArrayFilter(ids: number[]) {
  return sql`${sql.raw(`ARRAY[${ids.join(",")}]::integer[]`)}`;
}

router.get("/dashboard/stats", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    res.json({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      inProgressTasks: 0,
      tasksByStatus: [],
      tasksByPriority: [],
    });
    return;
  }

  const now = new Date();
  const allTasks = await db
    .select()
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ANY(${buildInArrayFilter(projectIds)})`);

  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = allTasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done").length;
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;

  const statusMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  for (const task of allTasks) {
    statusMap[task.status] = (statusMap[task.status] || 0) + 1;
    priorityMap[task.priority] = (priorityMap[task.priority] || 0) + 1;
  }

  res.json({
    totalProjects: projectIds.length,
    totalTasks: allTasks.length,
    completedTasks,
    overdueTasks,
    inProgressTasks,
    tasksByStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    tasksByPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
  });
});

router.get("/dashboard/my-tasks", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);

  const tasks = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      assigneeId: tasksTable.assigneeId,
      createdById: tasksTable.createdById,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        status: projectsTable.status,
        ownerId: projectsTable.ownerId,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      },
    })
    .from(tasksTable)
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(tasksTable.assigneeId, user.id));

  const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  res.json(
    tasks.map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      assignee: assignee ? { ...assignee, avatarUrl: assignee.avatarUrl ?? null } : null,
    }))
  );
});

router.get("/dashboard/activity", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    res.json([]);
    return;
  }

  const activities = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      description: activityTable.description,
      projectId: activityTable.projectId,
      userId: activityTable.userId,
      createdAt: activityTable.createdAt,
      projectName: projectsTable.name,
      userName: usersTable.name,
    })
    .from(activityTable)
    .innerJoin(projectsTable, eq(activityTable.projectId, projectsTable.id))
    .innerJoin(usersTable, eq(activityTable.userId, usersTable.id))
    .where(sql`${activityTable.projectId} = ANY(${buildInArrayFilter(projectIds)})`)
    .orderBy(desc(activityTable.createdAt))
    .limit(20);

  res.json(activities);
});

export default router;
