/**
 * Soft guard: skip granting when purchaser email looks like a self-test / seller account.
 */
export function isBillingSelfPurchase(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  const denylist = (process.env.BILLING_SELF_TEST_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (denylist.includes(normalized)) return true;

  const seller = (
    process.env.GUMROAD_SELLER_EMAIL ||
    process.env.BILLING_SELLER_EMAIL ||
    ""
  )
    .toLowerCase()
    .trim();

  return Boolean(seller && normalized === seller);
}
