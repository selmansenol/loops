/**
 * Drizzle schema for Loops.
 *
 * Two groups of tables live here:
 *  - better-auth tables (`user`, `session`, `account`, `verification`) — column
 *    names are what better-auth's drizzle adapter expects (camelCase JS keys).
 *  - Application tables (profiles, posts, votes, ...) — snake_case keys so the
 *    rows returned to the UI match the field names the components already use.
 *
 * All user references point at `user.id` (text), which is better-auth's id type.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================
// better-auth tables
// ============================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Enums
// ============================================================

export const postStatus = pgEnum("post_status", ["planned", "progress", "done"]);
// Roadmap priority bucket — a dimension separate from `status`, set by the
// admin AI Roadmap Generator (now = doing it, next = soon, later = backlog).
export const priorityBucket = pgEnum("priority_bucket", ["now", "next", "later"]);
// Per-workspace role (replaces the old global app_role).
export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "member"]);

// ============================================================
// Tenancy: workspaces & members
// ============================================================

// A workspace is one tenant's feedback board, reached at /<slug>. All app data
// (posts, api keys, webhooks, AI keys) is scoped to a workspace_id.
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    allow_guest_votes: boolean("allow_guest_votes").notNull().default(true),
    created_by: text("created_by").references(() => user.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workspaces_slug_idx").on(t.slug)],
);

export const workspace_members = pgTable(
  "workspace_members",
  {
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull().default("member"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspace_id, t.user_id] }),
    index("workspace_members_user_idx").on(t.user_id),
  ],
);

// ============================================================
// Application tables
// ============================================================

// Public-facing profile, one per auth user. Created via better-auth's
// `databaseHooks.user.create.after` (replaces the old handle_new_user trigger).
export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  username: text("username"),
  avatar_url: text("avatar_url"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    author_id: text("author_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    tag: text("tag"),
    status: postStatus("status").notNull().default("planned"),
    priority_bucket: priorityBucket("priority_bucket"),
    votes_count: integer("votes_count").notNull().default(0),
    source: text("source").notNull().default("web"),
    external_user_id: text("external_user_id"),
    shipped_at: timestamp("shipped_at", { withTimezone: true, mode: "string" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("posts_ws_status_idx").on(t.workspace_id, t.status),
    index("posts_ws_votes_idx").on(t.workspace_id, t.votes_count.desc()),
    index("posts_ws_created_idx").on(t.workspace_id, t.created_at.desc()),
  ],
);

// `user_id` is a generic voter key (a real user.id for web votes, or a derived
// stable key for anonymous API votes), so it intentionally has NO FK to `user`.
export const votes = pgTable(
  "votes",
  {
    post_id: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    user_id: text("user_id").notNull(),
    external_user_id: text("external_user_id"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.post_id, t.user_id] }), index("votes_user_idx").on(t.user_id)],
);

// Registered users following a post (auto-added when they vote/comment/author).
// Notifications (status change, new comment) go to a post's subscribers.
export const post_subscriptions = pgTable(
  "post_subscriptions",
  {
    post_id: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.post_id, t.user_id] }),
    index("post_subs_user_idx").on(t.user_id),
  ],
);

// One-click email opt-out (global). Presence = user receives no notifications.
export const notification_optouts = pgTable("notification_optouts", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    post_id: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    author_id: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    is_official: boolean("is_official").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_post_id_created_at_idx").on(t.post_id, t.created_at)],
);

export const api_keys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key_prefix: text("key_prefix").notNull(),
    key_hash: text("key_hash").notNull().unique(),
    key_type: text("key_type").notNull(), // 'secret' | 'publishable'
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY['read']::text[]`),
    created_by: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    last_used_at: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
    revoked_at: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_api_keys_hash").on(t.key_hash)],
);

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspace_id: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events")
    .array()
    .notNull()
    .default(sql`ARRAY['post.created']::text[]`),
  secret: text("secret")
    .notNull()
    .default(sql`encode(gen_random_bytes(24), 'hex')`),
  active: boolean("active").notNull().default(true),
  last_delivery_at: timestamp("last_delivery_at", { withTimezone: true, mode: "string" }),
  last_status: integer("last_status"),
  last_error: text("last_error"),
  created_by: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const webhook_deliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhook_id: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    status: integer("status"),
    response_snippet: text("response_snippet"),
    attempted_at: timestamp("attempted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_deliveries_webhook").on(t.webhook_id, t.attempted_at.desc())],
);

export const ai_provider_keys = pgTable(
  "ai_provider_keys",
  {
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'openai' | 'anthropic' | 'google'
    api_key: text("api_key").notNull(),
    model: text("model"), // null = use the provider's default model
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_by: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.workspace_id, t.provider] })],
);

// ============================================================
// Inferred types
// ============================================================

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspace_members.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type ApiKey = typeof api_keys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type AiProviderKey = typeof ai_provider_keys.$inferSelect;
