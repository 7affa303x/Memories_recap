import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listJobsForUser } from "@/lib/store";
import { getBillingSummary } from "@/lib/billing/credits";

/**
 * Export account summary: jobs + billing (no raw video bytes).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email;

  const [jobs, billing] = await Promise.all([
    listJobsForUser(userId),
    getBillingSummary(userId, email),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      email,
      name: session.user.name ?? null,
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      title: j.title,
      folder: j.folder ?? null,
      total_bytes: j.total_bytes,
      file_count: j.file_count,
      credits_charged: j.credits_charged,
      created_at: j.created_at,
      completed_at: j.completed_at,
      share_expires_at: j.share_expires_at,
    })),
    billing: {
      balance: billing.balance,
      freeGranted: billing.freeGranted,
      subscription: billing.subscription
        ? {
            status: billing.subscription.status,
            currentPeriodEnd: billing.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: billing.subscription.cancelAtPeriodEnd,
          }
        : null,
      transactions: billing.transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        createdAt: tx.createdAt,
      })),
      dailyLoginGrantedToday: billing.dailyLoginGrantedToday,
      dailyLoginAmount: billing.dailyLoginAmount,
      dailyLoginCap: billing.dailyLoginCap,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="memories-recap-export-${userId.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
