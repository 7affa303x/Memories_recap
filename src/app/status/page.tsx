"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

type HealthPayload = {
  ok: boolean;
  status: string;
  at?: string;
  checks?: Record<string, boolean | string>;
};

export default function StatusPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as HealthPayload;
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not reach health");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const healthy = data?.ok === true;
  const degraded = data && !data.ok;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/" className="min-h-11 px-2 text-sm text-neutral-500">
          Home
        </Link>
      </header>

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-green-900">
            Status
          </h1>
          <p className="mt-2 text-neutral-500">
            Live check of Memories Recap services.
          </p>
        </div>

        <div
          className={`rounded-[16px] px-5 py-6 shadow-sm ${
            healthy
              ? "bg-green-50 text-green-900"
              : degraded || error
                ? "bg-amber-50 text-amber-950"
                : "bg-neutral-50 text-neutral-600"
          }`}
        >
          <p className="text-sm font-medium uppercase tracking-wide opacity-70">
            Overall
          </p>
          <p className="mt-2 text-2xl font-medium">
            {error
              ? "Unreachable"
              : !data
                ? "Checking…"
                : healthy
                  ? "OK"
                  : "Degraded"}
          </p>
          {data?.at ? (
            <p className="mt-2 text-xs opacity-70">
              Checked {new Date(data.at).toLocaleString()}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm">{error}</p> : null}
        </div>

        {data?.checks ? (
          <ul className="space-y-2 text-sm">
            {Object.entries(data.checks).map(([key, value]) => (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-[12px] bg-neutral-50 px-4 py-3"
              >
                <span className="text-neutral-600">{key}</span>
                <span className="font-medium text-neutral-900">
                  {typeof value === "boolean" ? (value ? "yes" : "no") : String(value)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
