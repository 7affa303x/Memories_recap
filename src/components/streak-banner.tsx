"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOMENTS_NAME } from "@/lib/rewards/config";

type Props = {
  initialStreak?: number;
  initialLongest?: number;
  className?: string;
};

export function StreakBanner({
  initialStreak = 0,
  initialLongest = 0,
  className = "",
}: Props) {
  const [streak, setStreak] = useState(initialStreak);
  const [longest, setLongest] = useState(initialLongest);
  const [pulse, setPulse] = useState(false);
  const [dailyNote, setDailyNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.streakCurrent === "number") setStreak(j.streakCurrent);
        if (typeof j.streakLongest === "number") setLongest(j.streakLongest);
        if (j.dailyLoginGrantedToday && j.dailyLoginAmount) {
          setDailyNote(`+${j.dailyLoginAmount} ${MOMENTS_NAME} today`);
          setPulse(true);
          const t = setTimeout(() => setPulse(false), 1800);
          return () => clearTimeout(t);
        }
      })
      .catch(() => undefined);
  }, []);

  const days = Math.max(0, streak);
  const dots = Array.from({ length: 7 }, (_, i) => i < Math.min(days, 7));

  return (
    <div
      className={`relative overflow-hidden rounded-[16px] bg-gradient-to-r from-green-900 via-green-800 to-emerald-700 px-4 py-3 text-white shadow-sm ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 ${
          pulse ? "animate-streak-pop" : ""
        }`}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-green-100/90">
            Streak
          </p>
          <p className="mt-0.5 font-display text-xl font-semibold leading-tight">
            {days > 0 ? `${days}-day glow` : "Start your streak"}
          </p>
          <p className="mt-1 truncate text-xs text-green-100/80">
            {dailyNote ||
              (longest > days
                ? `Best so far: ${longest} days`
                : "Visit daily to keep the warmth going")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex gap-1">
            {dots.map((on, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  on
                    ? `bg-amber-300 ${pulse && i === Math.min(days, 7) - 1 ? "animate-streak-dot" : ""}`
                    : "bg-white/25"
                }`}
              />
            ))}
          </div>
          <Link
            href="/moments"
            className="pressable text-xs font-medium text-green-50 underline-offset-2 hover:underline"
          >
            Earn {MOMENTS_NAME}
          </Link>
        </div>
      </div>
    </div>
  );
}
