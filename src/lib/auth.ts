import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { isEmailAllowedToSignIn } from "@/lib/access";

/** Google sign-in is enabled when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set. */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: Provider[] = [
  Resend({
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.AUTH_EMAIL_FROM,
  }),
];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // The same person may have signed in by email first (e.g. the admin). Google verifies
      // address ownership and we additionally require email_verified below, so linking a
      // Google login to the existing user with that exact email is safe here.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Auth.js v5 config — Node runtime only (uses the Drizzle adapter / database sessions).
 * Edge middleware does NOT import this file; see src/middleware.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers,
  pages: {
    signIn: "/signin",
    // Show every auth error (AccessDenied, email delivery failure, ...) on our own page.
    error: "/signin",
    verifyRequest: "/signin?check-email=1",
  },
  callbacks: {
    /**
     * Invite-only gate. Runs before a magic-link email is sent, when a link is opened, and
     * after Google returns. Returning false shows "AccessDenied" and nothing else happens.
     */
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google" && profile?.email_verified !== true) return false;
        const email = account?.provider === "google" ? (profile?.email ?? user?.email) : user?.email;
        return await isEmailAllowedToSignIn(email);
      } catch (err) {
        console.error("[auth] signIn gate failed", err);
        return false;
      }
    },
    session({ session, user }) {
      // Database strategy: `user` is the adapter row. Expose its id to the app.
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
});
