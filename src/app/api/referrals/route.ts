import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { REFERRALS_ENABLED } from "@/lib/flags";
import { getAppUrl } from "@/lib/billing/config";
import { REWARD } from "@/lib/rewards/config";

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
    inviterReward: REWARD.referralInviter,
    inviteeReward: REWARD.referralInvitee,
    note: `You earn +${REWARD.referralInviter} Moments when a friend signs in. They get +${REWARD.referralInvitee}.`,
  });
}
