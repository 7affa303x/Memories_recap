/**
 * User-facing currency name. Internally still stored as credits.
 * "Moments" feels warmer than "credits" and less like a toll booth.
 */
export const MOMENTS_NAME = "Moments";
export const MOMENTS_NAME_SINGULAR = "Moment";

export function formatMoments(amount: number) {
  const n = Math.max(0, Math.round(amount));
  return `${n} ${n === 1 ? MOMENTS_NAME_SINGULAR : MOMENTS_NAME}`;
}

/** Reward amounts (engagement-first). */
export const REWARD = {
  signup: Number(process.env.FREE_CREDITS || 200),
  dailyLogin: Number(process.env.DAILY_LOGIN_CREDITS || 50),
  dailyCap: Number(process.env.DAILY_LOGIN_BALANCE_CAP || 800),
  referralInviter: Number(process.env.REFERRAL_INVITER_MOMENTS || 200),
  referralInvitee: Number(process.env.REFERRAL_INVITEE_MOMENTS || 50),
  familyShare: Number(process.env.FAMILY_SHARE_MOMENTS || 50),
  firstRecap: Number(process.env.FIRST_RECAP_MOMENTS || 100),
  rating: Number(process.env.RATING_MOMENTS || 20),
  streak7: Number(process.env.STREAK_7_MOMENTS || 150),
  streak30: Number(process.env.STREAK_30_MOMENTS || 500),
  maxReferralGrantsPerMonth: Number(process.env.REFERRAL_MONTHLY_CAP || 10),
} as const;

export const REWARD_COPY = [
  { label: "Welcome gift", amount: REWARD.signup, hint: "Once, when you join" },
  {
    label: "Daily visit",
    amount: REWARD.dailyLogin,
    hint: `Every day you’re here (under ${REWARD.dailyCap} Moments)`,
  },
  {
    label: "Invite a friend",
    amount: REWARD.referralInviter,
    hint: "When they sign in for the first time",
  },
  {
    label: "Friend’s welcome",
    amount: REWARD.referralInvitee,
    hint: "Extra Moments for the person you invite",
  },
  {
    label: "Family share",
    amount: REWARD.familyShare,
    hint: "First family link with a password on a recap",
  },
  {
    label: "First recap",
    amount: REWARD.firstRecap,
    hint: "Completing your first story",
  },
  {
    label: "Rate a recap",
    amount: REWARD.rating,
    hint: "Honest 1–5 after watching",
  },
  {
    label: "7-day streak",
    amount: REWARD.streak7,
    hint: "Visit seven days in a row",
  },
  {
    label: "30-day streak",
    amount: REWARD.streak30,
    hint: "A whole month of showing up",
  },
] as const;
