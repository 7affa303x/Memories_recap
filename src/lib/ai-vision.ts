import { readFile } from "node:fs/promises";

export type VisionScore = {
  score: number; // 0..1
  provider: string;
};

export type VisionTier = "free" | "pro";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseScore(text: string) {
  const num = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] || "0");
  if (num <= 1) return clamp01(num);
  return clamp01(num / 10);
}

type ProviderFn = (b64: string) => Promise<VisionScore | null>;

/** Rotate across free providers when one hits quota (429 / null). */
let freeCursor = 0;

async function scoreWithGemini(
  b64: string,
  model: string,
  mime = "image/jpeg"
) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Rate this memory frame 0-10 for people/faces, emotion, color, clarity, interesting action, and scene quality. Reply with ONLY a number.",
            },
            { inline_data: { mime_type: mime, data: b64 } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    }),
  });
  if (res.status === 429 || res.status === 403) return null;
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return {
    score: parseScore(text),
    provider: `gemini:${model}`,
  } satisfies VisionScore;
}

async function scoreWithOpenAiCompatible(input: {
  b64: string;
  key: string;
  baseUrl: string;
  model: string;
  provider: string;
}) {
  const res = await fetch(
    `${input.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 40,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Rate this memory frame 0-10 for people/faces, emotion, color, clarity, and interesting action. Reply with only a number.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${input.b64}`,
                },
              },
            ],
          },
        ],
      }),
    }
  );
  if (res.status === 429 || res.status === 403) return null;
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content || "";
  return {
    score: parseScore(text),
    provider: input.provider,
  } satisfies VisionScore;
}

function buildFreeProviders(): ProviderFn[] {
  const list: ProviderFn[] = [];

  const geminiModels = (
    process.env.GEMINI_FREE_MODELS ||
    "gemini-flash-lite-latest,gemini-2.0-flash-lite,gemini-2.0-flash"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const model of geminiModels) {
    list.push((b64) => scoreWithGemini(b64, model));
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModels = (
      process.env.GROQ_FREE_MODELS ||
      process.env.GROQ_VISION_MODEL ||
      "meta-llama/llama-4-scout-17b-16e-instruct"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const model of groqModels) {
      list.push((b64) =>
        scoreWithOpenAiCompatible({
          b64,
          key: groqKey,
          baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
          model,
          provider: `groq:${model}`,
        })
      );
    }
  }

  const openAiKey =
    process.env.OPENAI_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (openAiKey) {
    list.push((b64) =>
      scoreWithOpenAiCompatible({
        b64,
        key: openAiKey,
        baseUrl:
          process.env.OPENAI_BASE_URL ||
          process.env.AI_GATEWAY_URL ||
          "https://api.openai.com/v1",
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        provider: "openai:gpt-4o-mini",
      })
    );
  }

  return list;
}

async function scorePro(b64: string): Promise<VisionScore | null> {
  const proModel =
    process.env.GEMINI_PRO_VISION_MODEL ||
    process.env.VISION_PRO_MODEL ||
    "gemini-2.0-flash";
  const gemini = await scoreWithGemini(b64, proModel).catch(() => null);
  if (gemini) return gemini;

  const openAiKey =
    process.env.OPENAI_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (openAiKey) {
    return scoreWithOpenAiCompatible({
      b64,
      key: openAiKey,
      baseUrl:
        process.env.OPENAI_BASE_URL ||
        process.env.AI_GATEWAY_URL ||
        "https://api.openai.com/v1",
      model: process.env.OPENAI_PRO_VISION_MODEL || "gpt-4o",
      provider: "openai:pro",
    }).catch(() => null);
  }
  return null;
}

/**
 * Score a JPEG frame.
 * Free: rotate across available free models on failure/quota.
 * Pro: prefer stronger paid model, then fall back to free rotation.
 */
export async function scoreMemoryFrame(
  framePath: string,
  tier: VisionTier = "free"
): Promise<VisionScore | null> {
  const b64 = (await readFile(framePath)).toString("base64");

  if (tier === "pro") {
    const pro = await scorePro(b64).catch(() => null);
    if (pro) return pro;
  }

  const providers = buildFreeProviders();
  if (providers.length === 0) return null;

  const start = freeCursor % providers.length;
  freeCursor = (freeCursor + 1) % Math.max(1, providers.length);

  for (let i = 0; i < providers.length; i++) {
    const fn = providers[(start + i) % providers.length];
    const result = await fn(b64).catch(() => null);
    if (result) return result;
  }
  return null;
}

export function hasVisionProvider() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_AI_GATEWAY_API_KEY
  );
}
