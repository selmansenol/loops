/**
 * Integration tests against a real Postgres (DATABASE_URL).
 *
 * Focus: the security-critical invariants — multi-tenant isolation (every query
 * scoped by workspace_id), vote de-duplication, and API-key scope enforcement.
 * Each test makes its own fixtures and the suite cleans them up afterward.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { user, workspaces, api_keys } from "@/db/schema";
import { inArray } from "drizzle-orm";
import {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleVote,
} from "@/lib/posts.repo";
import { authenticateRequest, generateApiKey, hashKey, requireScope } from "@/lib/api-auth.server";

const createdWorkspaces: string[] = [];
const createdUsers: string[] = [];

async function mkUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `${id}@test.local`,
    emailVerified: true,
  });
  createdUsers.push(id);
  return id;
}

async function mkWorkspace(ownerId: string): Promise<string> {
  const [row] = await db
    .insert(workspaces)
    .values({ slug: `test-${randomUUID().slice(0, 12)}`, name: "Test WS", created_by: ownerId })
    .returning({ id: workspaces.id });
  createdWorkspaces.push(row.id);
  return row.id;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for integration tests");
});

afterAll(async () => {
  if (createdWorkspaces.length) {
    await db.delete(workspaces).where(inArray(workspaces.id, createdWorkspaces));
  }
  if (createdUsers.length) {
    await db.delete(user).where(inArray(user.id, createdUsers));
  }
});

describe("multi-tenant isolation (posts)", () => {
  it("a post created in workspace A is invisible/immutable from workspace B", async () => {
    const owner = await mkUser();
    const wsA = await mkWorkspace(owner);
    const wsB = await mkWorkspace(owner);

    const post = await createPost({ workspace_id: wsA, title: "Dark mode" });

    // Visible only in A
    const inA = await listPosts(wsA);
    const inB = await listPosts(wsB);
    expect(inA.map((p) => p.id)).toContain(post.id);
    expect(inB.map((p) => p.id)).not.toContain(post.id);

    // Not fetchable cross-tenant
    expect(await getPostById(wsB, post.id)).toBeNull();
    expect(await getPostById(wsA, post.id)).not.toBeNull();

    // Not mutable cross-tenant
    expect(await updatePost(wsB, post.id, { status: "done" })).toBeNull();
    expect((await getPostById(wsA, post.id))?.status).toBe("planned");

    // Not deletable cross-tenant
    await deletePost(wsB, post.id);
    expect(await getPostById(wsA, post.id)).not.toBeNull();
  });
});

describe("vote de-duplication + isolation", () => {
  it("toggling a vote is idempotent and keeps votes_count in sync", async () => {
    const owner = await mkUser();
    const wsA = await mkWorkspace(owner);
    const post = await createPost({ workspace_id: wsA, title: "Export CSV" });
    const voter = `guest:test:${randomUUID()}`;

    const first = await toggleVote(wsA, post.id, voter);
    expect(first.voted).toBe(true);
    expect((await getPostById(wsA, post.id))?.votes_count).toBe(1);

    // Same voter toggling again removes the vote (no double counting)
    const second = await toggleVote(wsA, post.id, voter);
    expect(second.voted).toBe(false);
    expect((await getPostById(wsA, post.id))?.votes_count).toBe(0);
  });

  it("cannot vote on a post from another workspace", async () => {
    const owner = await mkUser();
    const wsA = await mkWorkspace(owner);
    const wsB = await mkWorkspace(owner);
    const post = await createPost({ workspace_id: wsA, title: "Webhooks" });

    await expect(toggleVote(wsB, post.id, "guest:x")).rejects.toThrow();
  });
});

describe("API key auth + scope", () => {
  it("generateApiKey/hashKey round-trips and prefixes by type", () => {
    const sk = generateApiKey("secret");
    expect(sk.plain.startsWith("loop_sk_")).toBe(true);
    expect(hashKey(sk.plain)).toBe(sk.hash);

    const pk = generateApiKey("publishable");
    expect(pk.plain.startsWith("loop_pk_")).toBe(true);
  });

  it("authenticates a valid key to its workspace and enforces scopes", async () => {
    const owner = await mkUser();
    const wsA = await mkWorkspace(owner);
    const { plain, prefix, hash } = generateApiKey("secret");
    await db.insert(api_keys).values({
      workspace_id: wsA,
      name: "test key",
      key_prefix: prefix,
      key_hash: hash,
      key_type: "secret",
      scopes: ["read"],
      created_by: owner,
    });

    const req = new Request("http://localhost/api/v1/posts", {
      headers: { Authorization: `Bearer ${plain}` },
    });
    const res = await authenticateRequest(req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.key.workspace_id).toBe(wsA);
      expect(res.key.scopes).toContain("read");
      // read scope passes a read check, fails a write check
      expect(requireScope(res.key, "read")).toBeNull();
      expect(requireScope(res.key, "write")).not.toBeNull();
    }
  });

  it("rejects an unknown / malformed key", async () => {
    const bad = await authenticateRequest(
      new Request("http://localhost/api/v1/posts", {
        headers: { Authorization: "Bearer loop_sk_doesnotexist" },
      }),
    );
    expect(bad.ok).toBe(false);

    const noHeader = await authenticateRequest(new Request("http://localhost/api/v1/posts"));
    expect(noHeader.ok).toBe(false);
  });
});
