import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getBillingSummary } from "@/lib/billing/credits";
import { getBillingProvider } from "@/lib/billing/config";
import { Button } from "@/components/ui/button";
import { FREE_CREDITS } from "@/lib/billing/config";
import { CheckoutSuccessBeacon } from "@/components/checkout-success-beacon";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Billing",
  description: "Credits, subscription, and payment history for Memories Recap.",
};

function humanSubscription(
  summary: Awaited<ReturnType<typeof getBillingSummary>>
) {
  const sub = summary.subscription;
  if (!sub) {
    return {
      title: "Pay as you go",
      detail: `No monthly plan. You have ${summary.balance} credits ready to use.`,
    };
  }
  if (sub.status === "active" && sub.cancelAtPeriodEnd) {
    return {
      title: "Pro monthly — ending soon",
      detail: `Your plan stays active until ${
        sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
          : "period end"
      }. You keep credits until then.`,
    };
  }
  if (sub.status === "active") {
    return {
      title: "Pro monthly — active",
      detail: `Renews ${
        sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
          : "monthly"
      }. Manage card or cancel in the billing portal.`,
    };
  }
  return {
    title: `Subscription · ${sub.status}`,
    detail: "Open the billing portal to review or restart your plan.",
  };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; portal?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const summary = await getBillingSummary(user.id, user.email);
  const plan = humanSubscription(summary);
  const provider = getBillingProvider();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <CheckoutSuccessBeacon active={params.checkout === "success"} />
      <AppHeader active="billing" />

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Billing</h1>
          <p className="mt-2 text-neutral-500">
            Plain-language view of your balance and plan.
          </p>
        </div>

        {params.checkout === "success" ? (
          <p className="rounded-[16px] bg-green-50 px-4 py-3 text-sm text-green-800">
            Payment received. Credits usually appear within a few seconds after
            webhook confirmation.
          </p>
        ) : null}

        {params.portal === "missing" ? (
          <p className="rounded-[16px] bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No customer record yet. Complete a purchase first to open the portal.
          </p>
        ) : null}

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Available credits</p>
          <p className="mt-2 text-3xl font-medium">{summary.balance}</p>
          <p className="mt-2 text-sm text-neutral-500">
            {summary.balance === 0
              ? "Buy a pack to process videos. About 1 credit ≈ 1 MB."
              : `Enough for roughly ${summary.balance} MB of processing (min 10 per job).`}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Free starter grant:{" "}
            {summary.freeGranted
              ? `already used (${FREE_CREDITS} credits)`
              : "available on first sign-in"}
          </p>
          {"dailyLoginAmount" in summary && summary.dailyLoginAmount ? (
            <p className="mt-2 text-sm text-neutral-500">
              Daily login: +{summary.dailyLoginAmount} credits when balance ≤{" "}
              {summary.dailyLoginCap}
              {summary.dailyLoginGrantedToday ? " · credited today" : ""}.
            </p>
          ) : null}
          <p className="mt-2 text-sm text-neutral-500">
            Pack credits expire in 90 days. Pro monthly grants last 365 days so
            unused balance can roll into the next months honestly.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Plan</p>
          <p className="mt-2 text-lg font-medium">{plan.title}</p>
          <p className="mt-2 text-sm text-neutral-500">{plan.detail}</p>
        </div>

        <div className="grid gap-3">
          <Button asChild className="h-12 rounded-[16px] text-base">
            <Link href="/pricing">Buy credits</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-12 rounded-[16px] bg-white text-base shadow-sm"
          >
            <a href="/api/billing/portal">
              {provider === "gumroad"
                ? "Manage on Gumroad"
                : "Open billing portal"}
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-12 rounded-[16px] text-base text-neutral-600"
          >
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        <div>
          <h2 className="text-lg font-medium">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {summary.transactions.length === 0 ? (
              <li className="text-sm text-neutral-500">No purchases yet</li>
            ) : (
              summary.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="rounded-[16px] bg-neutral-50 px-4 py-3 text-sm shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{tx.type.replace(/_/g, " ")}</span>
                    <span>{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</span>
                  </div>
                  <p className="mt-1 text-neutral-500">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
