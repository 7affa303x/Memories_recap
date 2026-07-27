import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  findOrCreatePaddleCustomer,
  getPaddleClient,
} from "@/lib/billing/paddle";
import {
  getAppUrl,
  getPriceId,
} from "@/lib/billing/config";
import type { ProductKey } from "@/lib/billing/types";
import {
  getBillingSummary,
  setPaddleCustomerId,
} from "@/lib/billing/credits";

const ALLOWED: ProductKey[] = [
  "subscription",
  "credits_small",
  "credits_medium",
  "credits_large",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { product?: string };
  const product = body.product as ProductKey | undefined;
  if (!product || !ALLOWED.includes(product)) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  try {
    const priceId = getPriceId(product);
    const paddle = getPaddleClient();
    const appUrl = getAppUrl();
    const summary = await getBillingSummary(session.user.id, session.user.email);

    const customer = await findOrCreatePaddleCustomer({
      email: session.user.email,
      userId: session.user.id,
      existingCustomerId: summary.paddleCustomerId,
    });
    await setPaddleCustomerId(session.user.id, session.user.email, customer.id);

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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
