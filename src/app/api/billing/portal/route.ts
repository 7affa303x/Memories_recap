import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAppUrl } from "@/lib/billing/config";
import { getBillingSummary } from "@/lib/billing/credits";
import { getCreemClient } from "@/lib/billing/creem";

export async function GET() {
  const appUrl = getAppUrl();
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL("/api/auth/signin", appUrl));
  }

  const summary = await getBillingSummary(session.user.id, session.user.email);
  if (!summary.creemCustomerId) {
    return NextResponse.redirect(new URL("/billing?portal=missing", appUrl));
  }

  try {
    const creem = getCreemClient();
    const portal = await creem.customers.generateBillingLinks({
      customerId: summary.creemCustomerId,
    });
    if (!portal.customerPortalLink) {
      return NextResponse.json(
        { error: "Portal URL missing" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(portal.customerPortalLink);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Portal session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
