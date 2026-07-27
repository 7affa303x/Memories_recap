import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("_healthcheck").select("*").limit(1);

  // Missing table is fine — proves REST + keys work.
  if (error && error.code !== "PGRST116" && error.code !== "42P01" && !/relation|does not exist|Could not find/i.test(error.message)) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    project: process.env.SUPABASE_PROJECT_REF,
    rest: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
  });
}
