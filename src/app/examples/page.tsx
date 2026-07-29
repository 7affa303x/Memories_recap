import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Examples · ${BRAND_NAME}`,
  description:
    "Sample stills from Memories Recap — landscape and vertical end cards. Try it with your own clips.",
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
            Examples
          </h1>
          <p className="text-neutral-500">
            Still frames from a finished recap — not staged testimonials. Upload
            your own clips to see the full motion cut.
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-[16px] bg-neutral-900 shadow-sm">
            <Image
              src="/brand/end-card-landscape.png"
              alt="Sample landscape recap still"
              width={960}
              height={540}
              className="aspect-video w-full object-cover"
              priority
            />
            <p className="px-3 py-2 text-xs text-neutral-300">Landscape still</p>
          </div>
          <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-[16px] bg-neutral-900 shadow-sm sm:mx-0 sm:max-w-none">
            <Image
              src="/brand/end-card-vertical.png"
              alt="Sample vertical recap still"
              width={540}
              height={960}
              className="aspect-[9/16] w-full object-cover"
            />
            <p className="px-3 py-2 text-xs text-neutral-300">Vertical still</p>
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
