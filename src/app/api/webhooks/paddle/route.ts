import { NextResponse } from "next/server";
import { getPaddleClient } from "@/lib/billing/paddle";
import { getPaddleWebhookSecret } from "@/lib/billing/config";
import { handlePaddleEvent } from "@/lib/billing/paddle-webhooks";
import { isPaddleWebhookIpAllowed } from "@/lib/billing/paddle-ips";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipCheck = await isPaddleWebhookIpAllowed(request);
  if (!ipCheck.ok) {
    console.warn("paddle webhook rejected", ipCheck);
    return NextResponse.json(
      { error: "Forbidden", reason: ipCheck.reason },
      { status: 403 }
    );
  }

  const signature = request.headers.get("paddle-signature") || "";
  const rawBody = await request.text();

  try {
    const paddle = getPaddleClient();
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      getPaddleWebhookSecret(),
      signature
    );
    await handlePaddleEvent(event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook verification failed";
    console.error("paddle webhook error", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
