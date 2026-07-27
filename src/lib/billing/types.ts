export type CreditSource = "free" | "subscription" | "pack" | "refund_restore";

export type BillingSubscription = {
  id: string;
  polarSubscriptionId: string;
  polarProductId: string;
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
  polarEventId?: string | null;
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
  polarEventId?: string | null;
  polarOrderId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type BillingState = {
  version: number;
  userId: string;
  email: string;
  polarCustomerId: string | null;
  freeGranted: boolean;
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
