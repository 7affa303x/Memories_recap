import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  handleGumroadRefundPayload,
  handleGumroadSalePayload,
  handleGumroadSubscriptionLifecycle,
} from "@/lib/billing/gumroad-webhooks";
import { gumroadWebhookBodySchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

function timingSafeTokenEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function authorize(request: Request): { ok: true } | { ok: false; status: 401 | 503 } {
  const secret = process.env.GUMROAD_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503 };
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-gumroad-token") ||
    "";
  if (!timingSafeTokenEqual(token, secret)) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  form.forEach((value, key) => {
    out[key] = typeof value === "string" ? value : value.name;
  });
  return out;
}

function detectType(raw: Record<string, unknown>) {
  const resource =
    (typeof raw.resource_name === "string" && raw.resource_name) ||
    (typeof raw.type === "string" && raw.type) ||
    "";
  if (resource) return resource;
  if (raw.refunded === "true" || raw.partially_refunded === "true") {
    return "refund";
  }
  if (raw.sale_id || raw.product_id || raw.product_permalink) return "sale";
  return "sale";
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503
            ? "Gumroad webhook secret not configured"
            : "Unauthorized",
      },
      { status: auth.status }
    );
  }

  try {
    const rawBody = await parseBody(request);
    const parsed = parseOr400(gumroadWebhookBodySchema, rawBody);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, details: parsed.details },
        { status: 400 }
      );
    }
    const raw = parsed.data as Record<string, unknown>;
    const type = detectType(raw);

    switch (type) {
      case "refund":
        await handleGumroadRefundPayload(raw);
        break;
      case "cancellation":
      case "subscription_ended":
      case "subscription_restarted":
      case "subscription_updated":
        await handleGumroadSubscriptionLifecycle(type, raw);
        // Renewals often arrive as sale too — sale handler grants credits
        if (type === "subscription_updated" || type === "subscription_restarted") {
          await handleGumroadSalePayload(raw).catch(() => undefined);
        }
        break;
      case "sale":
      case "dispute":
      case "dispute_won":
      default:
        if (type === "sale" || raw.sale_id) {
          await handleGumroadSalePayload(raw);
        }
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gumroad webhook failed";
    console.error("gumroad webhook error", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Gumroad sometimes probes with GET */
export async function GET() {
  return NextResponse.json({ ok: true, provider: "gumroad" });
}
