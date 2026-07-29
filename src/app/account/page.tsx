import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { AccountActions } from "@/components/account-actions";
import { REFERRALS_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your Memories Recap account, export, or delete data.",
};

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="account" />

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Account</h1>
          <p className="mt-2 text-neutral-500">
            Export a copy of your data or delete your account. Billing details
            live on the credits page.
          </p>
        </div>

        <AccountActions
          email={user.email}
          userId={user.id}
          referralsEnabled={REFERRALS_ENABLED}
        />

        <p className="text-sm text-neutral-500">
          Need help?{" "}
          <Link href="/support" className="text-green-700 underline">
            Support
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </section>
    </main>
  );
}
