import { CustomerPortal } from "@polar-sh/nextjs";
import { auth } from "@/auth";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER === "sandbox"
    ? "sandbox"
    : "production") as "sandbox" | "production",
  returnUrl: `${(
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")}/billing`,
  getExternalCustomerId: async () => {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    return session.user.id;
  },
});
