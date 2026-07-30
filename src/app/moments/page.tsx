import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { StreakBanner } from "@/components/streak-banner";
import { getBillingSummary } from "@/lib/billing/credits";
import { Button } from "@/components/ui/button";
import {
  formatMoments,
  MOMENTS_NAME,
  REWARD,
  REWARD_COPY,
} from "@/lib/rewards/config";
import { REFERRALS_ENABLED, EARN_ENABLED } from "@/lib/flags";
import { getAppUrl } from "@/lib/billing/config";
import { welcomeLine } from "@/lib/greeting";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: `${MOMENTS_NAME} · Memories Recap`,
  description: "Earn Moments by visiting, inviting, sharing, and creating.",
};

export default async function MomentsPage() {
  if (!EARN_ENABLED) redirect("/billing");
  const user = await requireUser();
  const summary = await getBillingSummary(user.id, user.email);
  const inviteUrl = REFERRALS_ENABLED
    ? `${getAppUrl()}/?ref=${encodeURIComponent(user.id)}`
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="moments" />
      <section className="mt-8 space-y-6 animate-fade-up">
        <StreakBanner
          initialStreak={summary.streakCurrent || 0}
          initialLongest={summary.streakLongest || 0}
        />

        <div>
          <p className="text-sm font-medium text-green-800">
            {welcomeLine({ name: user.name })}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-green-900">
            Your {MOMENTS_NAME}
          </h1>
          <p className="mt-2 text-neutral-500">
            Soft fuel for stories — earn by showing up, not by feeling sold to.
          </p>
        </div>

        <div className="rounded-[20px] bg-neutral-900 px-5 py-6 text-white shadow-sm">
          <p className="text-sm text-neutral-300">Balance</p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {formatMoments(summary.balance)}
          </p>
          {summary.dailyLoginGrantedToday ? (
            <p className="mt-3 text-sm text-emerald-300">
              +{summary.dailyLoginAmount} from today’s visit
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              Come back tomorrow for +{summary.dailyLoginAmount}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium text-neutral-900">Ways to earn</h2>
          <ul className="space-y-2">
            {REWARD_COPY.map((row) => (
              <li
                key={row.label}
                className="flex items-start justify-between gap-3 rounded-[16px] bg-neutral-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-neutral-900">{row.label}</p>
                  <p className="mt-1 text-sm text-neutral-500">{row.hint}</p>
                </div>
                <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-900">
                  +{row.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {inviteUrl ? (
          <div className="rounded-[16px] bg-green-50 px-4 py-4">
            <p className="font-medium text-green-950">
              Invite a friend · +{REWARD.referralInviter} {MOMENTS_NAME}
            </p>
            <p className="mt-1 text-sm text-green-900/70">
              They get +{REWARD.referralInvitee} too when they sign in.
            </p>
            <p className="mt-3 break-all rounded-xl bg-white px-3 py-2 text-xs text-neutral-600">
              {inviteUrl}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          <Button asChild className="h-12 rounded-[16px] text-base">
            <Link href="/upload">Make a recap</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-12 rounded-[16px] bg-white text-base shadow-sm"
          >
            <Link href="/pricing">Need more? Quiet packs</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
