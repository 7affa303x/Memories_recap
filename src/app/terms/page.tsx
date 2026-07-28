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
            credits are restored. Successful jobs consume credits. Credits from
            packs expire after 90 days unless stated otherwise.
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
          <h2 className="text-lg font-medium text-neutral-900">Availability</h2>
          <p>
            Processing runs as background jobs and may take minutes depending on
            size. We aim for reliability but do not guarantee uninterrupted
            uptime.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Contact</h2>
          <p>
            <a className="underline" href="mailto:haffa303@gmail.com">
              haffa303@gmail.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
