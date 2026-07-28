import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SETUP !== "true") {
    return NextResponse.json(
      { error: "Setup migrate is disabled in production" },
      { status: 403 }
    );
  }

  const secret = process.env.SETUP_SECRET;
  const header = request.headers.get("x-setup-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    note: "SQL migrations are optional; runtime uses Storage. Enable ALLOW_SETUP=true to run SQL apply scripts manually.",
  });
}
