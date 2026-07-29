import { NextResponse } from "next/server";
import { runEmailCampaigns } from "@/lib/email/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.SETUP_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Cron endpoint for automated email campaigns.
 * Call with Authorization: Bearer <CRON_SECRET>
 * Schedule: every Monday at 9am UTC, plus daily at 10am UTC
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runEmailCampaigns();

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    campaigns: results,
    total: Object.values(results).reduce((a, b) => a + b, 0),
  });
}
