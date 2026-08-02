import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCreemClient } from "@/lib/billing/creem";
import {
  getAppUrl,
  getBillingProvider,
  getProductId,
} from "@/lib/billing/config";
import { buildGumroadCheckoutUrl } from "@/lib/billing/gumroad";
import { createWhopCheckoutUrl } from "@/lib/billing/whop";
import { getBillingSummary } from "@/lib/billing/credits";
import { isSubscriptionProduct } from "@/lib/billing/pricing";
import { checkoutCreateBodySchema, parseOr400 } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = parseOr400(checkoutCreateBodySchema, raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, details: parsed.details },
      { status: 400 }
    );
  }
  const product = parsed.data.product;
  const interval = parsed.data.interval ?? "monthly";

  const provider = getBillingProvider();

  try {
    if (provider === "whop") {
      const summary = await getBillingSummary(
        session.user.id,
        session.user.email
      );
      const memberTier = summary.memberTier ?? null;
      const checkout = await createWhopCheckoutUrl({
        product,
        userId: session.user.id,
        email: session.user.email,
        interval: isSubscriptionProduct(product) ? interval : "monthly",
        packBuyerDiscount: Boolean(summary.proDiscountEligible),
        memberTier,
      });
      return NextResponse.json({
        url: checkout.url,
        id: checkout.id,
        provider: "whop",
        quote: checkout.quote,
      });
    }

    if (provider === "gumroad") {
      const url = buildGumroadCheckoutUrl({
        product,
        userId: session.user.id,
        email: session.user.email,
      });
      return NextResponse.json({
        url,
        provider: "gumroad",
      });
    }

    const creem = getCreemClient();
    const appUrl = getAppUrl();
    const checkout = await creem.checkouts.create({
      productId: getProductId(product),
      requestId: session.user.id,
      successUrl: `${appUrl}/billing?checkout=success`,
      customer: { email: session.user.email },
      metadata: {
        userId: session.user.id,
        email: session.user.email,
        product,
        interval,
      },
    });

    if (!checkout.checkoutUrl) {
      return NextResponse.json(
        { error: "Checkout URL missing" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: checkout.checkoutUrl,
      id: checkout.id,
      provider: "creem",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
