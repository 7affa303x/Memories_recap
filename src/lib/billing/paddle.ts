import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  getPaddleApiKey,
  getPaddleEnvironment,
} from "@/lib/billing/config";

let client: Paddle | null = null;

export function getPaddleClient() {
  if (client) return client;
  const environment =
    getPaddleEnvironment() === "sandbox"
      ? Environment.sandbox
      : Environment.production;
  client = new Paddle(getPaddleApiKey(), { environment });
  return client;
}

export async function findOrCreatePaddleCustomer(input: {
  email: string;
  userId: string;
  existingCustomerId?: string | null;
}) {
  const paddle = getPaddleClient();

  if (input.existingCustomerId) {
    try {
      return await paddle.customers.get(input.existingCustomerId);
    } catch {
      // fall through and recreate / lookup by email
    }
  }

  const listed = paddle.customers.list({
    email: [input.email],
    perPage: 5,
  });
  const matches = await listed.next();
  const existing = matches[0];
  if (existing) {
    if (!existing.customData || !(existing.customData as { userId?: string }).userId) {
      try {
        return await paddle.customers.update(existing.id, {
          customData: { userId: input.userId, email: input.email },
        });
      } catch {
        return existing;
      }
    }
    return existing;
  }

  return paddle.customers.create({
    email: input.email,
    customData: { userId: input.userId, email: input.email },
  });
}
