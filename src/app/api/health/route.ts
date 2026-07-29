import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { hasVisionProvider } from "@/lib/ai-vision";
import { isCreemTestMode } from "@/lib/billing/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean | string> = {
    app: true,
    creemKey: Boolean(process.env.CREEM_API_KEY),
    creemWebhook: Boolean(process.env.CREEM_WEBHOOK_SECRET),
    creemTestMode: isCreemTestMode(),
    authGoogle: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    visionAi: hasVisionProvider(),
  };

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

  const ok =
    checks.app &&
    checks.creemKey &&
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
