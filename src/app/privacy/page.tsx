import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy · Memories Recap",
  description:
    "How Memories Recap handles your videos, account data, and share links.",
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
        <p>Last updated: July 29, 2026</p>

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
          <h2 className="text-lg font-medium text-neutral-900">Retention</h2>
          <p>
            Recap outputs are kept about 30 days on Free and about 90 days on
            Pro. Credit packs expire after 90 days. Active Pro subscription
            credit grants last 365 days. Original uploads are not deleted
            automatically unless you remove them, delete your account, or ask
            us to. Share links expire per the window shown when you create
            them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Subprocessors</h2>
          <p>We use trusted providers to run the product:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Google Auth — sign-in</li>
            <li>Supabase — private storage and app data</li>
            <li>Vercel — hosting and serverless compute</li>
            <li>Vercel Blob — large video uploads when configured</li>
            <li>
              Gumroad and/or Creem — payments as merchant of record, depending
              on configuration
            </li>
            <li>Resend — optional &quot;recap ready&quot; email</li>
            <li>
              Gemini, Groq, and/or OpenAI — optional vision scoring when API
              keys are configured
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Your rights
          </h2>
          <p>
            You can access, export, or delete your account data via the{" "}
            <Link href="/account" className="underline">
              account
            </Link>{" "}
            page tools (export JSON, delete account) or by emailing support. We
            will honor reasonable requests to correct profile details or remove
            stored jobs and billing records, subject to legal retention needs
            (for example fraud prevention).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Cookies and pixels
          </h2>
          <p>
            We use essential cookies for sign-in sessions. Optional advertising
            pixels (Meta, TikTok) load only when configured and after you accept
            the cookie banner. You can dismiss or refuse optional pixels; core
            product cookies remain required to stay signed in.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Payments</h2>
          <p>
            Payments are handled by the configured merchant of record — Gumroad
            (primary when set) or Creem as fallback — not Creem-only. We receive
            signed webhooks to credit your balance. Card details are not stored
            on our servers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Contact</h2>
          <p>
            Privacy questions:{" "}
            <a className="underline" href="mailto:support@memoriesrecap.app">
              support@memoriesrecap.app
            </a>{" "}
            or{" "}
            <a className="underline" href="mailto:haffa303@gmail.com">
              haffa303@gmail.com
            </a>
            . Also see{" "}
            <Link href="/support" className="underline">
              Support
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
