import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCreemClient } from "@/lib/billing/creem";
import {
  getAppUrl,
  getBillingProvider,
  getPriceId,
  getProductId,
} from "@/lib/billing/config";
import { buildGumroadCheckoutUrl } from "@/lib/billing/gumroad";
import {
  findOrCreatePaddleCustomer,
  getPaddleClient,
} from "@/lib/billing/paddle";
import {
  getBillingSummary,
  setPaddleCustomerId,
} from "@/lib/billing/credits";
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

  const provider = getBillingProvider();

  try {
    if (provider === "paddle") {
      const priceId = getPriceId(product);
      const paddle = getPaddleClient();
      const appUrl = getAppUrl();
      const summary = await getBillingSummary(
        session.user.id,
        session.user.email
      );

      const customer = await findOrCreatePaddleCustomer({
        email: session.user.email,
        userId: session.user.id,
        existingCustomerId: summary.paddleCustomerId,
      });
      await setPaddleCustomerId(
        session.user.id,
        session.user.email,
        customer.id
      );

      const transaction = await paddle.transactions.create({
        items: [{ priceId, quantity: 1 }],
        customerId: customer.id,
        customData: {
          userId: session.user.id,
          email: session.user.email,
          product,
        },
        checkout: {
          url: `${appUrl}/billing?checkout=success`,
        },
      });

      return NextResponse.json({
        transactionId: transaction.id,
        id: transaction.id,
        provider: "paddle",
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
