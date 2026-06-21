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
import { emailEnabled, sendEmail, emailLayout } from "@/lib/email.server";

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
    // Verification is only enforced when an email provider (Resend) is wired.
    // Self-host installs without RESEND_API_KEY keep sign-in open.
    requireEmailVerification: emailEnabled(),
    ...(emailEnabled()
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendEmail({
              to: user.email,
              subject: "Reset your Loops password",
              html: emailLayout({
                heading: "Reset your password",
                body: "We received a request to reset your Loops password. Click below to choose a new one. This link expires in 1 hour.",
                ctaLabel: "Reset password",
                ctaUrl: url,
              }),
            });
          },
        }
      : {}),
  },
  ...(emailEnabled()
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            await sendEmail({
              to: user.email,
              subject: "Verify your email for Loops",
              html: emailLayout({
                heading: "Confirm your email",
                body: "Welcome to Loops! Confirm your email address to activate your account and start building your feedback board.",
                ctaLabel: "Verify email",
                ctaUrl: url,
              }),
            });
          },
        },
      }
    : {}),
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
