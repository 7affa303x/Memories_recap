import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  const header = request.headers.get("x-setup-secret");

  if (!setupSecret || header !== setupSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL missing" }, { status: 500 });
  }

  const sqlPath = join(process.cwd(), "supabase/migrations/20260727170000_initial.sql");
  const sql = await readFile(sqlPath, "utf8");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
