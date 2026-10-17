import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { isEmailAllowedToSignIn } from "@/lib/access";

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
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin?check-email=1",
  },
  callbacks: {
    /**
     * Invite-only: runs before the magic-link email is sent and again when the link is
     * opened. Returning false shows the "AccessDenied" message and sends no email.
     */
    async signIn({ user }) {
      return isEmailAllowedToSignIn(user?.email);
    },
    session({ session, user }) {
      // Database strategy: `user` is the adapter row. Expose its id to the app.
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
});
