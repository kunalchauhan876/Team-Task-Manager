import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { UpdateMeBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getOrCreateUser(clerkId: string, email: string, name: string) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [user] = await db
    .insert(usersTable)
    .values({ clerkId, email, name: name || email.split("@")[0] })
    .returning();

  return user;
}

export { getOrCreateUser };

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = userId;
  next();
}

export { requireAuth };

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const email = (auth as any)?.sessionClaims?.email || "";
  const fullName = (auth as any)?.sessionClaims?.fullName || (auth as any)?.sessionClaims?.username || email.split("@")[0];

  const user = await getOrCreateUser(req.clerkId, email, fullName);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  });
});

router.put("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const email = (auth as any)?.sessionClaims?.email || "";
  const fullName = (auth as any)?.sessionClaims?.fullName || email.split("@")[0];

  const user = await getOrCreateUser(req.clerkId, email, fullName);

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    avatarUrl: updated.avatarUrl ?? null,
    createdAt: updated.createdAt,
  });
});

export default router;
