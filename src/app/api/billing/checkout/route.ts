import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCreemClient } from "@/lib/billing/creem";
import { getAppUrl, getProductId } from "@/lib/billing/config";
import type { ProductKey } from "@/lib/billing/types";

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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
