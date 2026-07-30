export type CreditSource =
  | "free"
  | "subscription"
  | "pack"
  | "refund_restore"
  | "daily_login"
  | "reward_referral"
  | "reward_family_share"
  | "reward_first_recap"
  | "reward_rating"
  | "reward_streak";

export type BillingSubscription = {
  id: string;
  creemSubscriptionId: string;
  creemProductId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

export type CreditLot = {
  id: string;
  source: CreditSource;
  originalAmount: number;
  remainingAmount: number;
  expiresAt: string;
  creemEventId?: string | null;
  createdAt: string;
};

export type CreditHistoryEntry = {
  id: string;
  lotId?: string | null;
  jobId?: string | null;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
};

export type BillingTransaction = {
  id: string;
  type: string;
  amount: number;
  creemEventId?: string | null;
  creemOrderId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type BillingState = {
  version: number;
  userId: string;
  email: string;
  creemCustomerId: string | null;
  /**
   * Paddle customer id (ctm_...) when BILLING_PROVIDER=paddle.
   * Also may appear in legacy Storage JSON from earlier Paddle experiments.
   */
  paddleCustomerId?: string | null;
  polarCustomerId?: string | null;
  freeGranted: boolean;
  /** True after any credit pack purchase — removes overlay watermark (end card kept). */
  watermarkExempt?: boolean;
  /** YYYY-MM-DD UTC of last daily login credit grant */
  lastDailyLoginGrantAt?: string | null;
  lots: CreditLot[];
  subscription: BillingSubscription | null;
  transactions: BillingTransaction[];
  history: CreditHistoryEntry[];
  jobCredits: Record<
    string,
    {
      charged: number;
      status: "reserved" | "consumed" | "restored" | "none";
    }
  >;
  updatedAt: string;
};

export type ProductKey =
  | "subscription"
  | "credits_small"
  | "credits_medium"
  | "credits_large";
