import Link from "next/link";
import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Support · Memories Recap",
  description: "Help and human support for Memories Recap.",
};

export default async function SupportPage() {
  const user = await getOptionalUser();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link
          href={user ? "/dashboard" : "/"}
          className="min-h-11 px-2 text-sm text-neutral-500"
        >
          {user ? "Dashboard" : "Home"}
        </Link>
      </header>

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Support</h1>
          <p className="mt-2 text-neutral-500">
            We build for lasting customers. If a recap fails or looks wrong,
            tell us — we restore credits on system failures.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm font-medium">Email</p>
          <a
            className="mt-2 block text-green-700 underline"
            href="mailto:haffa303@gmail.com?subject=Memories%20Recap%20support"
          >
            haffa303@gmail.com
          </a>
          <p className="mt-3 text-sm text-neutral-500">
            Pro subscribers: we aim to reply within a few hours on business days.
            Include your account email and job link when possible.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 text-sm text-neutral-600 shadow-sm">
          <p className="font-medium text-neutral-900">Before you write</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Check Billing → credits balance</li>
            <li>Open the job from Dashboard for status/errors</li>
            <li>Try Remix with another mood if the cut feels off</li>
          </ul>
        </div>

        <p className="text-sm text-neutral-500">
          {BRAND_NAME} is built to keep your memories watchable — not to trap
          you with dark patterns.
        </p>
      </section>
    </main>
  );
}
