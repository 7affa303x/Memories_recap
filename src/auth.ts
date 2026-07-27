import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "@/lib/jobs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account?.providerAccountId) return false;
      await upsertUser({
        id: account.providerAccountId,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      });
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
