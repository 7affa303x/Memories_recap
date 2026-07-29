import { NextResponse } from "next/server";
import { listMusicTracks, isPaidMusicEnabled } from "@/lib/music";
import { MOOD_PROFILES } from "@/lib/mood";

export async function GET() {
  const tracks = listMusicTracks().map((t) => ({
    id: t.id,
    title: t.title,
    mood: t.mood,
    vibe: t.vibe,
    previewUrl: t.publicPath,
  }));

  return NextResponse.json({
    paidEnabled: isPaidMusicEnabled(),
    moods: Object.values(MOOD_PROFILES).map((m) => ({
      id: m.id,
      label: m.label,
    })),
    tracks,
  });
}
