import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Examples · ${BRAND_NAME}`,
  description:
    "See how Memories Recap turns messy camera rolls into calm landscape and vertical stories.",
};

export default function ExamplesPage() {
  return (
    <main className="min-h-full bg-[radial-gradient(1000px_520px_at_50%_-8%,#dcfce7,transparent),linear-gradient(180deg,#f8faf9_0%,#ffffff_42%,#f0fdf4_100%)]">
      <div className="mx-auto flex w-full max-w-lg flex-col px-6 pb-20 pt-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/pricing" className="min-h-11 px-2 text-sm text-neutral-500">
            Pricing
          </Link>
        </header>

        <section className="mt-10 space-y-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-green-900">
            How a recap feels
          </h1>
          <p className="text-neutral-500">
            We don’t show staged end-card stills as “examples”. The real product
            is motion: pick clips, choose a mood, and get landscape + vertical.
          </p>
        </section>

        <section className="mt-8 overflow-hidden rounded-[20px] border border-green-100 bg-neutral-900 shadow-sm">
          <div className="aspect-video bg-[linear-gradient(135deg,#14532d_0%,#052e16_55%,#166534_100%)] p-6 text-white">
            <p className="text-sm text-green-100/90">What you get</p>
            <p className="mt-8 font-display text-3xl font-semibold leading-snug">
              From messy camera rolls → one calm story.
            </p>
            <p className="mt-4 max-w-sm text-sm text-green-50/90">
              Smart moment selection, NCS mood music, and exports ready for the
              couch or Stories.
            </p>
          </div>
        </section>

        <div className="mt-10">
          <Button asChild className="h-12 w-full rounded-[16px] text-base">
            <Link href="/upload">Make your own recap</Link>
          </Button>
          <p className="mt-3 text-center text-sm text-neutral-500">
            Or{" "}
            <Link href="/" className="text-green-800 underline underline-offset-2">
              learn how it works
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
