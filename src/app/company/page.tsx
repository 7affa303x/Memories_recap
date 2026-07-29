import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `About · ${BRAND_NAME}`,
  description: `About ${BRAND_NAME} and the company behind the product.`,
};

export default function CompanyPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/" className="min-h-11 px-2 text-sm text-neutral-500">
          Home
        </Link>
      </header>

      <article className="mt-10 space-y-6 text-sm leading-relaxed text-neutral-600">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-neutral-900">
            About {BRAND_NAME}
          </h1>
          <p className="mt-2">
            {BRAND_NAME} helps families turn long phone videos into calm,
            watchable landscape and vertical recaps.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Company</h2>
          <p>
            Legal entity details (LLC name, registered address, and contact
            officer) will be published here upon formation. Until then,{" "}
            {BRAND_NAME} is operated as a pre-formation product at
            memoriesrecap.app.
          </p>
          <p>
            For billing, privacy, or support questions, email{" "}
            <a
              className="text-green-700 underline"
              href="mailto:haffa303@gmail.com?subject=Memories%20Recap%20company"
            >
              haffa303@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Policies</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-2">
            <Link href="/terms" className="text-green-700 underline">
              Terms
            </Link>
            <Link href="/privacy" className="text-green-700 underline">
              Privacy
            </Link>
            <Link href="/support" className="text-green-700 underline">
              Support
            </Link>
          </p>
        </section>
      </article>
    </main>
  );
}
