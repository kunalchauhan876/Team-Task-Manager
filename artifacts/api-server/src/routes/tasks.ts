import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, tasksTable, projectMembersTable, usersTable, activityTable } from "@workspace/db";
import { CreateTaskBody, UpdateTaskBody, ListProjectTasksQueryParams } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "./users";

const router: IRouter = Router();

async function resolveUser(req: any) {
  const clerkAuth = getAuth(req);
  const email = (clerkAuth as any)?.sessionClaims?.email || "";
  const fullName = (clerkAuth as any)?.sessionClaims?.fullName || (clerkAuth as any)?.sessionClaims?.username || email.split("@")[0];
  return getOrCreateUser(req.clerkId, email, fullName);
}

async function getProjectMember(projectId: number, userId: number) {
  const members = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)))
    .limit(1);
  return members[0] || null;
}

async function formatTask(task: typeof tasksTable.$inferSelect) {
  const [assignee] = task.assigneeId
    ? await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId)).limit(1)
    : [null];
  const [createdBy] = await db.select().from(usersTable).where(eq(usersTable.id, task.createdById)).limit(1);

  return {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    assignee: assignee ? { ...assignee, avatarUrl: assignee.avatarUrl ?? null } : null,
    createdBy: createdBy ? { ...createdBy, avatarUrl: createdBy.avatarUrl ?? null } : null,
  };
}

router.get("/projects/:id/tasks", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const queryParams = ListProjectTasksQueryParams.safeParse(req.query);

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId));

  let filtered = tasks;
  if (queryParams.success) {
    if (queryParams.data.status) {
      filtered = filtered.filter((t) => t.status === queryParams.data.status);
    }
    if (queryParams.data.assigneeId) {
      filtered = filtered.filter((t) => t.assigneeId === queryParams.data.assigneeId);
    }
  }

  const formatted = await Promise.all(filtered.map(formatTask));
  res.json(formatted);
});

router.post("/projects/:id/tasks", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  const member = await getProjectMember(projectId, user.id);
  if (!member) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: (parsed.data.status as string) || "todo",
      priority: (parsed.data.priority as string) || "medium",
      assigneeId: parsed.data.assigneeId ?? null,
      createdById: user.id,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate as string) : null,
    })
    .returning();

  await db.insert(activityTable).values({
    type: "task_created",
    description: `Created task "${task.title}"`,
    projectId,
    userId: user.id,
  });

  res.status(201).json(task);
});

router.get("/tasks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const taskId = parseInt(raw, 10);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const member = await getProjectMember(task.projectId, user.id);
  if (!member) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(await formatTask(task));
});

router.patch("/tasks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const taskId = parseInt(raw, 10);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const member = await getProjectMember(task.projectId, user.id);
  if (!member) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.assigneeId !== undefined) updates.assigneeId = parsed.data.assigneeId ?? null;
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate as string) : null;

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, taskId))
    .returning();

  if (parsed.data.status === "done") {
    await db.insert(activityTable).values({
      type: "task_completed",
      description: `Completed task "${updated.title}"`,
      projectId: task.projectId,
      userId: user.id,
    });
  } else if (parsed.data.status) {
    await db.insert(activityTable).values({
      type: "task_updated",
      description: `Updated task "${updated.title}" to ${(parsed.data.status as string).replace("_", " ")}`,
      projectId: task.projectId,
      userId: user.id,
    });
  }

  res.json(updated);
});

router.delete("/tasks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await resolveUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const taskId = parseInt(raw, 10);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const member = await getProjectMember(task.projectId, user.id);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
  res.sendStatus(204);
});

export default router;
