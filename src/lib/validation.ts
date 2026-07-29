import { z } from "zod";

/** Gumroad Ping / resource_subscription form fields (loose — unknown keys kept). */
export const gumroadWebhookBodySchema = z
  .object({
    sale_id: z.string().optional(),
    id: z.string().optional(),
    purchase_id: z.string().optional(),
    email: z.string().optional(),
    product_id: z.string().optional(),
    product_permalink: z.string().optional(),
    short_product_id: z.string().optional(),
    permalink: z.string().optional(),
    product_name: z.string().optional(),
    name: z.string().optional(),
    resource_name: z.string().optional(),
    type: z.string().optional(),
    refunded: z.union([z.string(), z.boolean()]).optional(),
    partially_refunded: z.union([z.string(), z.boolean()]).optional(),
    user_id: z.string().optional(),
    userid: z.string().optional(),
    subscription_id: z.string().optional(),
    status: z.string().optional(),
    url_params: z.unknown().optional(),
  })
  .passthrough();

export const sharePasswordBodySchema = z.object({
  password: z.string().min(1).optional(),
});

export const shareCreateBodySchema = z.object({
  expiresInDays: z.number().int().positive().max(365).optional(),
  password: z.string().optional(),
  audience: z.enum(["public", "family"]).optional(),
});

export const checkoutCreateBodySchema = z.object({
  product: z.enum([
    "subscription",
    "credits_small",
    "credits_medium",
    "credits_large",
  ]),
});

export const jobProcessBodySchema = z
  .object({
    musicMode: z.enum(["none", "manual", "auto"]).optional(),
    trackId: z.string().nullable().optional(),
    mood: z.enum(["joyful", "nostalgic", "chill", "epic"]).nullable().optional(),
    outputQuality: z.enum(["fhd", "uhd"]).nullable().optional(),
    folder: z.string().nullable().optional(),
    maxSeconds: z.number().int().nullable().optional(),
    endCardTitle: z.string().max(80).nullable().optional(),
    endCardShowDate: z.boolean().nullable().optional(),
    hideEndCard: z.boolean().nullable().optional(),
  })
  .passthrough();

export function parseOr400<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string; details: unknown } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: "Invalid request body",
    details: result.error.flatten(),
  };
}
