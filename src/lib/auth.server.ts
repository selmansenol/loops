/**
 * better-auth server instance — the single source of truth for auth.
 *
 * Replaces Supabase Auth: email/password + optional Google/GitHub OAuth, with
 * httpOnly cookie sessions. Social providers are only registered when their
 * credentials are present, so the app boots fine with email/password alone.
 *
 * Server-only. Import from server handlers, never from client code.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { user, session, account, verification, profiles } from "@/db/schema";

type SocialProviders = NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]>;

function buildSocialProviders(): SocialProviders {
  const providers: SocialProviders = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  return providers;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    // No email service is wired by default, so don't gate sign-in on verification.
    requireEmailVerification: false,
  },
  socialProviders: buildSocialProviders(),
  databaseHooks: {
    user: {
      create: {
        // Replaces the old `handle_new_user` trigger: every new auth user gets
        // a public profile row.
        after: async (createdUser) => {
          const username = createdUser.name?.trim() || createdUser.email.split("@")[0];
          await db
            .insert(profiles)
            .values({
              id: createdUser.id,
              username,
              avatar_url: createdUser.image ?? null,
            })
            .onConflictDoNothing();
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
