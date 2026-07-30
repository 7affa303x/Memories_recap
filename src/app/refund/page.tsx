import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Refund Policy · Memories Recap",
  description:
    "Refund rules for Moments packs, subscriptions, and failed processing on Memories Recap.",
};

export default function RefundPage() {
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
          Refund Policy
        </h1>
        <p>Last updated: July 29, 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Overview</h2>
          <p>
            Memories Recap sells digital Moments packs and optional Pro
            subscriptions used to process memory videos into recaps. Because
            delivery is digital and processing starts quickly after purchase,
            refunds follow the rules below.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Failed processing
          </h2>
          <p>
            If a job fails because of a system error on our side, reserved
            Moments are restored automatically. That is the primary remedy for
            failed processing — you keep your balance to try again.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Unused purchases
          </h2>
          <p>
            Requests for unused Moments packs within 14 days of purchase may be
            reviewed case by case when little or no Moments balance has been
            spent. Contact{" "}
            <a
              className="text-green-700 underline"
              href="mailto:haffa303@gmail.com"
            >
              haffa303@gmail.com
            </a>{" "}
            with your account email and order ID.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Used Moments &amp; completed recaps
          </h2>
          <p>
            Moments already consumed by successful jobs, and completed recap
            outputs you have downloaded or shared, are generally not refundable.
            Dissatisfaction with automated clip selection alone is not grounds
            for a cash refund.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Subscriptions
          </h2>
          <p>
            You can cancel Pro anytime so it does not renew. Cancellation stops
            future charges; it does not automatically refund the current billing
            period unless required by applicable law or the payment provider.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Payment provider
          </h2>
          <p>
            Card payments are processed by the configured merchant of record
            (for example Paddle, Gumroad, or Creem). Their checkout and dispute
            rules may also apply. Where provider rules conflict with this page
            on chargebacks or statutory rights, the stronger consumer protection
            for your region wins.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">How to ask</h2>
          <p>
            Email{" "}
            <a
              className="text-green-700 underline"
              href="mailto:haffa303@gmail.com"
            >
              haffa303@gmail.com
            </a>{" "}
            or open{" "}
            <Link href="/support" className="text-green-700 underline">
              Support
            </Link>
            . Include the email on the purchase and any receipt or order ID. We
            aim to reply within a few business days.
          </p>
        </section>

        <p className="pt-4 text-xs text-neutral-400">
          See also{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
