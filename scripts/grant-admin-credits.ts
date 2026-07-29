import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i);
  const v = line.slice(i + 1);
  if (!(k in process.env)) process.env[k] = v;
}

import { grantCredits, getBillingSummary } from "../src/lib/billing/credits";

async function main() {
  const userId = "107062661166700609472";
  const email = "haffa303@gmail.com";

  await grantCredits({
    userId,
    email,
    amount: 10000,
    source: "pack",
    creemEventId: `admin_grant_10000_${Date.now()}`,
    type: "admin_grant",
    metadata: { reason: "admin_bootstrap", by: "cursor_agent" },
  });

  const summary = await getBillingSummary(userId, email);
  console.log(
    JSON.stringify(
      {
        email,
        balance: summary.balance,
        freeGranted: summary.freeGranted,
        latestTx: summary.transactions.slice(0, 3),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
