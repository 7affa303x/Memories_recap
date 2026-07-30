import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { upsertUser } from "@/lib/jobs";
import { ensureBillingUser } from "@/lib/billing/credits";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { REFERRALS_ENABLED } from "@/lib/flags";
import {
  grantReferralInvitee,
  grantReferralInviter,
} from "@/lib/rewards/grants";
import { getServiceSupabase } from "@/lib/supabase/admin";

const useSecureCookies = process.env.NODE_ENV === "production";

async function applyReferralReward(inviteeId: string, inviteeEmail: string) {
  if (!REFERRALS_ENABLED) return;
  try {
    const jar = await cookies();
    const inviterId = jar.get("mr_ref")?.value;
    if (!inviterId || inviterId === inviteeId) return;

    const supabase = getServiceSupabase();
    const { data } = await supabase.storage
      .from("app-data")
      .download(`users/${inviterId}.json`);
    if (!data) return;
    const inviter = JSON.parse(await data.text()) as {
      id: string;
      email?: string;
    };
    if (!inviter.email) return;

    await grantReferralInvitee(inviteeId, inviteeEmail, inviterId);
    await grantReferralInviter(inviter.id, inviter.email, inviteeId);
    jar.delete("mr_ref");
  } catch (error) {
    console.error("referral apply failed", error);
  }
}

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
        await ensureBillingUser(account.providerAccountId, user.email);
        await applyReferralReward(account.providerAccountId, user.email);
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
    async jwt({ token, account, profile, user }) {
      if (account?.providerAccountId) {
        token.uid = account.providerAccountId;
      } else if (!token.uid && profile && "sub" in profile && profile.sub) {
        token.uid = profile.sub;
      }
      // Persist Google profile photo like Gmail (JWT sessions drop it otherwise)
      const picture =
        (user as { image?: string | null } | undefined)?.image ||
        (profile && "picture" in profile
          ? String((profile as { picture?: string }).picture || "")
          : "") ||
        token.picture;
      if (picture) token.picture = picture;
      if (user?.name) token.name = user.name;
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid);
      }
      if (session.user) {
        if (token.picture) session.user.image = String(token.picture);
        if (token.name) session.user.name = String(token.name);
        if (token.email) session.user.email = String(token.email);
      }
      return session;
    },
  },
  trustHost: true,
});
