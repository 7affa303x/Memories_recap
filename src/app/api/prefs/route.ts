import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserPrefs, saveUserPrefs } from "@/lib/user-prefs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getUserPrefs(session.user.id);
  return NextResponse.json(prefs);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const prefs = await saveUserPrefs(session.user.id, {
    defaultMood: (body.defaultMood as never) || undefined,
    defaultMusicMode: (body.defaultMusicMode as never) || undefined,
    defaultTrackId: (body.defaultTrackId as string | null) ?? undefined,
    defaultOutputQuality: (body.defaultOutputQuality as never) || undefined,
    lastFolder: (body.lastFolder as string | null) ?? undefined,
    endCardTitle:
      typeof body.endCardTitle === "string"
        ? body.endCardTitle.slice(0, 80)
        : body.endCardTitle === null
          ? null
          : undefined,
    endCardShowDate:
      typeof body.endCardShowDate === "boolean"
        ? body.endCardShowDate
        : undefined,
    hideEndCard:
      typeof body.hideEndCard === "boolean" ? body.hideEndCard : undefined,
  });
  return NextResponse.json(prefs);
}
