/**
 * Authorization helpers — the app-layer replacement for the old RLS
 * `has_role()` function. Server-only (touches the DB).
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { user_roles } from "@/db/schema";

export async function hasRole(userId: string, role: "admin" | "user"): Promise<boolean> {
  const rows = await db
    .select({ id: user_roles.id })
    .from(user_roles)
    .where(and(eq(user_roles.user_id, userId), eq(user_roles.role, role)))
    .limit(1);
  return rows.length > 0;
}

export function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, "admin");
}

/** Throws unless the user is an admin. Use at the top of admin-only handlers. */
export async function assertAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new Error("Forbidden: admin role required.");
  }
}
