import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { getBillingSummary } from "@/lib/billing/credits";
import { Button } from "@/components/ui/button";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const summary = await getBillingSummary(user.id, user.email);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/pricing" className="min-h-11 px-2 text-sm text-neutral-500">
          Pricing
        </Link>
      </header>

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Billing</h1>
          <p className="mt-2 text-neutral-500">
            Credits, subscription, and invoices.
          </p>
        </div>

        {params.checkout === "success" ? (
          <p className="rounded-[16px] bg-green-50 px-4 py-3 text-sm text-green-800">
            Payment received. Credits appear after webhook confirmation.
          </p>
        ) : null}

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Current credits</p>
          <p className="mt-2 text-3xl font-medium">{summary.balance}</p>
          <p className="mt-2 text-sm text-neutral-500">
            Free grant used: {summary.freeGranted ? "yes" : "no"}
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Subscription</p>
          {summary.subscription ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-medium capitalize">{summary.subscription.status}</p>
              <p className="text-neutral-500">
                Renewal:{" "}
                {summary.subscription.currentPeriodEnd
                  ? new Date(
                      summary.subscription.currentPeriodEnd
                    ).toLocaleDateString()
                  : "—"}
              </p>
              {summary.subscription.cancelAtPeriodEnd ? (
                <p className="text-neutral-500">
                  Cancels at period end. Access remains until then.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">No active subscription</p>
          )}
        </div>

        <div className="grid gap-3">
          <Button asChild className="h-12 rounded-[16px] text-base">
            <a href="/api/billing/portal">Billing portal</a>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-12 rounded-[16px] bg-white text-base shadow-sm"
          >
            <Link href="/pricing">Buy credits</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-12 rounded-[16px] text-base text-neutral-600"
          >
            <Link href="/upload">Back to upload</Link>
          </Button>
        </div>

        <div>
          <h2 className="text-lg font-medium">Invoices & transactions</h2>
          <ul className="mt-4 space-y-3">
            {summary.transactions.length === 0 ? (
              <li className="text-sm text-neutral-500">No transactions yet</li>
            ) : (
              summary.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="rounded-[16px] bg-neutral-50 px-4 py-3 text-sm shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{tx.type}</span>
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
