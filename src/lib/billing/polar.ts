import { Polar } from "@polar-sh/sdk";
import { getPolarAccessToken, getPolarServer } from "@/lib/billing/config";

let client: Polar | null = null;

export function getPolarClient() {
  if (client) return client;
  client = new Polar({
    accessToken: getPolarAccessToken(),
    server: getPolarServer(),
  });
  return client;
}
