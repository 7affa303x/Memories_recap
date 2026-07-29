import { Creem } from "creem";
import { getCreemApiKey, isCreemTestMode } from "@/lib/billing/config";

let client: Creem | null = null;

export function getCreemClient() {
  if (client) return client;
  client = new Creem({
    apiKey: getCreemApiKey(),
    server: isCreemTestMode() ? "test" : "prod",
  });
  return client;
}
