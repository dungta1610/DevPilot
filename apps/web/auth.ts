import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * NextAuth (Auth.js) configuration with GitHub OAuth.
 *
 * Reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET / AUTH_SECRET from the environment.
 * These are only required when running against the real backend; in mock mode
 * the login page offers a "demo mode" entry that skips OAuth entirely.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: "/login",
  },
});
