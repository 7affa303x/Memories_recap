import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAppUrl } from "@/lib/billing/config";
import { getBillingSummary } from "@/lib/billing/credits";
import { getPaddleClient } from "@/lib/billing/paddle";

export async function GET() {
  const appUrl = getAppUrl();
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL("/api/auth/signin", appUrl));
  }

  const summary = await getBillingSummary(session.user.id, session.user.email);
  if (!summary.paddleCustomerId) {
    return NextResponse.redirect(new URL("/billing?portal=missing", appUrl));
  }

  try {
    const paddle = getPaddleClient();
    const subscriptionIds = summary.subscription?.paddleSubscriptionId
      ? [summary.subscription.paddleSubscriptionId]
      : [];
    const portal = await paddle.customerPortalSessions.create(
      summary.paddleCustomerId,
      subscriptionIds
    );
    return NextResponse.redirect(portal.urls.general.overview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Portal session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
