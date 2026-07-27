import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPolarClient } from "@/lib/billing/polar";
import {
  getAppUrl,
  getProductId,
} from "@/lib/billing/config";
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
    const productId = getProductId(product);
    const polar = getPolarClient();
    const appUrl = getAppUrl();

    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: session.user.id,
      customerEmail: session.user.email,
      customerMetadata: {
        userId: session.user.id,
        email: session.user.email,
      },
      metadata: {
        userId: session.user.id,
        email: session.user.email,
        product,
      },
      successUrl: `${appUrl}/billing?checkout=success`,
      returnUrl: `${appUrl}/pricing`,
    });

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Checkout URL missing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkout.url, id: checkout.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
