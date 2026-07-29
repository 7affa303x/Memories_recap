import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBillingSummary } from "@/lib/billing/credits";

/**
 * Partial invoice / receipt history as JSON (credit ledger + transactions).
 * Not a full PDF — downloadable receipt-style export.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email;
  const billing = await getBillingSummary(userId, email);

  const receipts = billing.transactions
    .filter((tx) => tx.amount > 0 || tx.type.includes("pack") || tx.type.includes("subscription") || tx.type === "refund")
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountCredits: tx.amount,
      orderId: tx.creemOrderId ?? null,
      eventId: tx.creemEventId ?? null,
      createdAt: tx.createdAt,
      metadata: tx.metadata ?? {},
    }));

  const ledger = billing.history.map((entry) => ({
    id: entry.id,
    delta: entry.delta,
    reason: entry.reason,
    balanceAfter: entry.balanceAfter,
    jobId: entry.jobId ?? null,
    lotId: entry.lotId ?? null,
    createdAt: entry.createdAt,
  }));

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "memories-recap-receipts-v1",
    user: { id: userId, email },
    balance: billing.balance,
    receipts,
    ledger,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="memories-recap-receipts-${userId.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
