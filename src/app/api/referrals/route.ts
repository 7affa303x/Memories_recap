import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { REFERRALS_ENABLED } from "@/lib/flags";
import { getAppUrl } from "@/lib/billing/config";

/**
 * Referral scaffold.
 * - Disabled → 501
 * - Enabled → invite link with ?ref=userId (credit rewards not wired yet)
 */
export async function GET() {
  if (!REFERRALS_ENABLED) {
    return NextResponse.json(
      { error: "Referrals are not enabled", code: "REFERRALS_DISABLED" },
      { status: 501 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inviteCode = session.user.id;
  const inviteUrl = `${getAppUrl()}/?ref=${encodeURIComponent(inviteCode)}`;

  return NextResponse.json({
    enabled: true,
    inviteCode,
    inviteUrl,
    note: "Share your invite link. Credit rewards land in a later release.",
  });
}
