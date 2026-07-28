import { readFile } from "node:fs/promises";

export type VisionScore = {
  score: number; // 0..1
  provider: string;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseScore(text: string) {
  const num = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] || "0");
  // Accept 0-10 or 0-1
  if (num <= 1) return clamp01(num);
  return clamp01(num / 10);
}

async function scoreWithGemini(b64: string, mime = "image/jpeg") {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;
  const model =
    process.env.GEMINI_VISION_MODEL || "gemini-2.0-flash";
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
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { score: parseScore(text), provider: "gemini" } satisfies VisionScore;
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

/**
 * Score a JPEG frame using the first available vision provider:
 * Gemini → Groq → OpenAI / AI Gateway.
 */
export async function scoreMemoryFrame(framePath: string): Promise<VisionScore | null> {
  const b64 = (await readFile(framePath)).toString("base64");

  const gemini = await scoreWithGemini(b64).catch(() => null);
  if (gemini) return gemini;

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = await scoreWithOpenAiCompatible({
      b64,
      key: groqKey,
      baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      model:
        process.env.GROQ_VISION_MODEL ||
        "meta-llama/llama-4-scout-17b-16e-instruct",
      provider: "groq",
    }).catch(() => null);
    if (groq) return groq;
  }

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
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      provider: "openai",
    }).catch(() => null);
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
