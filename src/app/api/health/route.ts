import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { hasVisionProvider } from "@/lib/ai-vision";
import { getBillingProvider, isCreemTestMode } from "@/lib/billing/config";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import vercelConfig from "../../../../vercel.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasVercelCronConfigured() {
  const crons = (vercelConfig as { crons?: unknown[] }).crons;
  return Array.isArray(crons) && crons.length > 0;
}

export async function GET() {
  const provider = getBillingProvider();
  const checks: Record<string, boolean | string> = {
    app: true,
    billingProvider: provider,
    creemKey: Boolean(process.env.CREEM_API_KEY),
    creemWebhook: Boolean(process.env.CREEM_WEBHOOK_SECRET),
    creemTestMode: isCreemTestMode(),
    gumroadToken: Boolean(process.env.GUMROAD_ACCESS_TOKEN),
    gumroadWebhook: Boolean(process.env.GUMROAD_WEBHOOK_SECRET),
    // Soft check — present/absent reported but does not fail health alone
    blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    cronConfigured:
      hasVercelCronConfigured() ||
      Boolean(process.env.CRON_SECRET || process.env.SETUP_SECRET),
    authGoogle: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    visionAi: hasVisionProvider(),
    ffmpeg: Boolean(ffmpegPath),
    pipelineArtifacts: process.env.PIPELINE_ARTIFACTS !== "false",
    renderExtraDerivatives: process.env.RENDER_EXTRA_DERIVATIVES === "true",
  };

  if (ffmpegPath) {
    try {
      const child = spawn(ffmpegPath, ["-filters"], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      const code = await new Promise<number>((resolve) => child.on("close", resolve));
      // Informational only — end cards no longer require drawtext.
      checks.ffmpegDrawtext = code === 0 && stdout.includes("drawtext");
      checks.endCardDrawtextRequired = false;
    } catch {
      checks.ffmpegDrawtext = false;
      checks.endCardDrawtextRequired = false;
    }
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage.listBuckets();
    checks.storage = !error;
    checks.buckets = (data || [])
      .map((b) => `${b.name}:${b.public ? "public" : "private"}`)
      .join(",");
    const memories = data?.find((b) => b.name === "memories");
    checks.memoriesPrivate = Boolean(memories && !memories.public);
  } catch (error) {
    checks.storage = false;
    checks.storageError =
      error instanceof Error ? error.message : "storage_failed";
  }

  const billingConfigured =
    provider === "gumroad"
      ? Boolean(checks.gumroadToken)
      : Boolean(checks.creemKey);

  const ok =
    checks.app &&
    billingConfigured &&
    checks.authGoogle &&
    checks.supabaseUrl &&
    checks.supabaseService &&
    checks.storage === true &&
    checks.memoriesPrivate === true;

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "degraded",
      at: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
