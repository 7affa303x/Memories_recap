import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isCreemTestMode } from "@/lib/billing/config";
import { handleCreemWebhookEvent } from "@/lib/billing/webhooks";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string, secret: string) {
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature") || "";
  const secret = process.env.CREEM_WEBHOOK_SECRET || "";

  if (secret) {
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (!isCreemTestMode()) {
    return NextResponse.json(
      { error: "Missing CREEM_WEBHOOK_SECRET" },
      { status: 503 }
    );
  } else {
    console.warn(
      "CREEM_WEBHOOK_SECRET missing — accepting unsigned test webhook"
    );
  }

  try {
    const event = JSON.parse(rawBody) as {
      id?: string;
      eventType?: string;
      type?: string;
      object?: Record<string, unknown>;
      data?: Record<string, unknown>;
    };
    await handleCreemWebhookEvent(event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handling failed";
    console.error("creem webhook error", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
