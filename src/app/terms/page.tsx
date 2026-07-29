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
        <p>Last updated: July 29, 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Entity</h2>
          <p>
            Memories Recap / operator to be updated upon LLC formation. Until
            then, these terms describe the service operated at memoriesrecap.app
            and related deployments.
          </p>
        </section>

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
            Acceptable use
          </h2>
          <p>
            You may not use Memories Recap to upload or distribute illegal
            content, malware, malware, or material that infringes others&apos;
            rights; to probe or disrupt the service; to reverse-engineer music
            or branding assets; or to resell access in a way that circumvents
            credit or subscription pricing. We may suspend accounts that violate
            these rules.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Age</h2>
          <p>
            You must be at least 13 years old to use Memories Recap. If you are
            under the age of majority where you live, you need a parent or
            guardian&apos;s permission.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Commercial license
          </h2>
          <p>
            You may publish your recaps personally or commercially (ads, client
            work, social channels) when the footage is yours. Pro archive
            retention is longer; Free recaps expire sooner as disclosed on the
            result page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Music license</h2>
          <p>
            Music included in a recap is licensed only as part of that recap
            output under the music provider terms we use. Do not extract
            soundtrack files for unrelated projects or redistribute tracks
            separately from the recap video.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Refunds</h2>
          <p>
            Digital goods (Moments packs and subscriptions) follow our{" "}
            <Link href="/refund" className="text-green-700 underline">
              Refund Policy
            </Link>{" "}
            and the rules of the payment provider configured as merchant of
            record. If a job fails because of a system error on our side,
            reserved Moments are restored automatically — that is the primary
            remedy for failed processing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Disclaimer of warranties
          </h2>
          <p>
            The service is provided &quot;as is&quot; and &quot;as
            available.&quot; We do not warrant that every upload will produce a
            particular aesthetic result, that processing will always succeed, or
            that the service will be uninterrupted. Automated clip selection is
            imperfect by nature.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Limitation of liability
          </h2>
          <p>
            To the fullest extent permitted by law, Memories Recap and its
            operators are not liable for indirect, incidental, special,
            consequential, or punitive damages, or for lost profits, data, or
            goodwill arising from use of the service. Our aggregate liability
            for any claim related to the service is limited to the amounts you
            paid us for credits or subscription in the three months before the
            claim.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">Termination</h2>
          <p>
            You may stop using the service and request account deletion at any
            time from your account page or by contacting support. We may suspend
            or terminate access for abuse, non-payment, or legal risk. After
            deletion, retention windows for remaining files follow our privacy
            policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">DMCA</h2>
          <p>
            If you believe content on Memories Recap infringes your copyright,
            send a notice to{" "}
            <a className="underline" href="mailto:support@memoriesrecap.app">
              support@memoriesrecap.app
            </a>{" "}
            and{" "}
            <a className="underline" href="mailto:haffa303@gmail.com">
              haffa303@gmail.com
            </a>
            . Include the work claimed, the material&apos;s location, your
            contact details, and a good-faith statement under penalty of
            perjury. Placeholder contact addresses may be updated when the
            operating entity is finalized.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Governing law
          </h2>
          <p>
            Governing law and venue placeholder — to be updated upon LLC
            formation and registered address. Until then, disputes are handled
            in good faith via support before formal process.
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
