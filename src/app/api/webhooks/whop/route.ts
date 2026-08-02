import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { getWhopClient } from "@/lib/billing/whop";
import {
  handleWhopMembershipDeactivated,
  handleWhopPaymentSucceeded,
  handleWhopRefundCreated,
} from "@/lib/billing/whop-webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.WHOP_API_KEY || !process.env.WHOP_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Whop webhook not configured" },
      { status: 503 }
    );
  }

  const bodyText = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event: { type?: string; data?: unknown };
  try {
    const whop = getWhopClient();
    event = whop.webhooks.unwrap(bodyText, { headers }) as {
      type?: string;
      data?: unknown;
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Whop webhook";
    console.error("whop webhook verify failed", message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = event.type || "";
  const data =
    event.data && typeof event.data === "object"
      ? (event.data as Record<string, unknown>)
      : {};

  const run = async () => {
    switch (type) {
      case "payment.succeeded":
        await handleWhopPaymentSucceeded(data);
        break;
      case "membership.deactivated":
        await handleWhopMembershipDeactivated(data);
        break;
      case "refund.created":
        await handleWhopRefundCreated(data);
        break;
      default:
        break;
    }
  };

  try {
    waitUntil(run());
  } catch {
    await run();
  }

  return new Response("OK", { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "whop" });
}
