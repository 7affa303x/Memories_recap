import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "@/lib/jobs";
import { ensureBillingUser } from "@/lib/billing/credits";
import { sendWelcomeEmail } from "@/lib/email/welcome";

const useSecureCookies = process.env.NODE_ENV === "production";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    pkceCodeVerifier: {
      name: useSecureCookies
        ? "__Secure-authjs.pkce.code_verifier"
        : "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    callbackUrl: {
      name: useSecureCookies
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: useSecureCookies
        ? "__Host-authjs.csrf-token"
        : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account?.providerAccountId) return false;

      try {
        await upsertUser({
          id: account.providerAccountId,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
        // Non-blocking for login success; upload page also ensures billing
        await ensureBillingUser(account.providerAccountId, user.email);
        // First-time welcome (no-ops without RESEND_API_KEY; once per user)
        await sendWelcomeEmail({
          to: user.email,
          name: user.name,
          userId: account.providerAccountId,
        }).catch(() => undefined);
      } catch (error) {
        console.error("user/billing bootstrap failed", error);
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.providerAccountId) {
        token.uid = account.providerAccountId;
      } else if (!token.uid && profile && "sub" in profile && profile.sub) {
        token.uid = profile.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid);
      }
      return session;
    },
  },
  trustHost: true,
});
