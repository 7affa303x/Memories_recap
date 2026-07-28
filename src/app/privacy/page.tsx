import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy · Memory Recap",
  description:
    "How Memory Recap handles your videos, account data, and share links.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/" className="min-h-11 px-2 text-sm text-neutral-500">
          Home
        </Link>
      </header>

      <article className="mt-10 space-y-6 text-sm leading-relaxed text-neutral-600">
        <h1 className="text-2xl font-medium tracking-tight text-neutral-900">
          Privacy Policy
        </h1>
        <p>Last updated: July 27, 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">What we store</h2>
          <p>
            Account email and profile basics from sign-in, uploaded video files,
            generated recaps, billing credit balances, and optional share-link
            settings (token, expiry, password hash).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">How we use it</h2>
          <p>
            We process your videos only to build your recap (clip selection,
            encode, deliver). We do not sell your videos. Files are private by
            default. Share links use unguessable tokens and can include a
            password and expiry.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Originals</h2>
          <p>
            We do not delete your original uploads unless you remove them or ask
            us to. Recap outputs may expire after a retention period (about 30
            days) to control storage cost.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Payments</h2>
          <p>
            Payments are handled by Creem as merchant of record. We receive
            signed webhooks to credit your balance. Card details are not stored
            on our servers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Contact</h2>
          <p>
            Questions:{" "}
            <a className="underline" href="mailto:haffa303@gmail.com">
              haffa303@gmail.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
