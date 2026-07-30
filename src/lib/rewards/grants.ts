import { randomUUID } from "node:crypto";
import { grantCredits } from "@/lib/billing/credits";
import type { CreditSource } from "@/lib/billing/types";
import { REWARD } from "@/lib/rewards/config";
import { getServiceSupabase } from "@/lib/supabase/admin";

async function claimOnce(key: string) {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.storage.from("app-data").upload(
      `reward-locks/${key}.json`,
      JSON.stringify({ at: new Date().toISOString() }),
      { contentType: "application/json", upsert: false }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function grantRewardMoments(input: {
  userId: string;
  email: string;
  amount: number;
  source: CreditSource;
  lockKey: string;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.amount <= 0) return { ok: false as const, reason: "zero" as const };
  const claimed = await claimOnce(input.lockKey);
  if (!claimed) return { ok: false as const, reason: "already" as const };

  await grantCredits({
    userId: input.userId,
    email: input.email,
    amount: input.amount,
    source: input.source,
    creemEventId: `reward:${input.lockKey}`,
    type: input.type,
    metadata: input.metadata ?? {},
  });
  return { ok: true as const, amount: input.amount };
}

export async function grantFamilyShareReward(userId: string, email: string, jobId: string) {
  return grantRewardMoments({
    userId,
    email,
    amount: REWARD.familyShare,
    source: "reward_family_share",
    lockKey: `family-share-${userId}-${jobId}`,
    type: "family_share_reward",
    metadata: { jobId },
  });
}

export async function grantFirstRecapReward(userId: string, email: string, jobId: string) {
  return grantRewardMoments({
    userId,
    email,
    amount: REWARD.firstRecap,
    source: "reward_first_recap",
    lockKey: `first-recap-${userId}`,
    type: "first_recap_reward",
    metadata: { jobId },
  });
}

export async function grantRatingReward(userId: string, email: string, jobId: string) {
  return grantRewardMoments({
    userId,
    email,
    amount: REWARD.rating,
    source: "reward_rating",
    lockKey: `rating-${userId}-${jobId}`,
    type: "rating_reward",
    metadata: { jobId },
  });
}

export async function grantReferralInviter(
  inviterId: string,
  inviterEmail: string,
  inviteeId: string
) {
  const month = new Date().toISOString().slice(0, 7);
  return grantRewardMoments({
    userId: inviterId,
    email: inviterEmail,
    amount: REWARD.referralInviter,
    source: "reward_referral",
    lockKey: `referral-inviter-${inviterId}-${inviteeId}`,
    type: "referral_inviter_reward",
    metadata: { inviteeId, month },
  });
}

export async function grantReferralInvitee(userId: string, email: string, inviterId: string) {
  return grantRewardMoments({
    userId,
    email,
    amount: REWARD.referralInvitee,
    source: "reward_referral",
    lockKey: `referral-invitee-${userId}`,
    type: "referral_invitee_reward",
    metadata: { inviterId },
  });
}

export async function grantStreakBonus(
  userId: string,
  email: string,
  days: 7 | 30
) {
  const amount = days === 7 ? REWARD.streak7 : REWARD.streak30;
  return grantRewardMoments({
    userId,
    email,
    amount,
    source: "reward_streak",
    lockKey: `streak-${days}-${userId}-${new Date().toISOString().slice(0, 7)}-${days === 7 ? Math.ceil(new Date().getUTCDate() / 7) : "m"}`,
    type: `streak_${days}_reward`,
    metadata: { days },
  });
}

export function newRewardId() {
  return randomUUID();
}
