import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBillingSummary } from "@/lib/billing/credits";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getBillingSummary(session.user.id, session.user.email);
  return NextResponse.json(summary);
}
