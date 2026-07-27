import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServiceSupabase } from "@/lib/supabase/admin";

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

      const supabase = getServiceSupabase();
      const { error } = await supabase.from("users").upsert(
        {
          id: account.providerAccountId,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Failed to upsert user", error.message);
        return false;
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
