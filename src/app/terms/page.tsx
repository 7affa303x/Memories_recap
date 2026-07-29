import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Terms of Service · Memories Recap",
  description: "Terms for using Memories Recap.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p>Last updated: July 27, 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Service</h2>
          <p>
            Memories Recap turns uploaded memory videos into short landscape and
            vertical recaps. It is not a full video editor. Results depend on
            source quality and automated selection.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Credits</h2>
          <p>
            Processing uses credits based on total uploaded size (about 1 credit
            per MB, minimum 10). If processing fails on our side, reserved
            credits are restored. Successful jobs consume credits. Pack credits
            expire after 90 days. Active Pro subscription grants last 365 days
            so unused balance can carry across months honestly — not a trap.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Your content</h2>
          <p>
            You confirm you have rights to upload the videos. Do not upload
            illegal or harmful content. You keep ownership of your originals; we
            get a limited license to process and host outputs for the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Commercial license
          </h2>
          <p>
            You may publish your recaps personally or commercially (ads, client
            work, social channels) when the footage is yours. Music included in
            a recap is licensed only as part of that recap output under the
            music provider terms we use; do not extract soundtrack files for
            unrelated projects. Pro archive retention is longer; Free recaps
            expire sooner as disclosed on the result page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Availability</h2>
          <p>
            Processing runs as background jobs and may take minutes depending on
            size. We aim for reliability but do not guarantee uninterrupted
            uptime.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Support</h2>
          <p>
            Human help:{" "}
            <Link href="/support" className="underline">
              Support
            </Link>{" "}
            or{" "}
            <a className="underline" href="mailto:haffa303@gmail.com">
              haffa303@gmail.com
            </a>
            . Pro customers get priority replies.
          </p>
        </section>
      </article>
    </main>
  );
}
