"use client";

import { useEffect, useState } from "react";

type Props = {
  jobId: string;
  initialShareUrl?: string | null;
};

export function ShareControls({ jobId, initialShareUrl = null }: Props) {
  const [url, setUrl] = useState(initialShareUrl);
  const [password, setPassword] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [audience, setAudience] = useState<"public" | "family">("public");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [momentsNote, setMomentsNote] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/share`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.url) setUrl(j.url);
        if (typeof j.viewCount === "number") setViewCount(j.viewCount);
      })
      .catch(() => undefined);
  }, [jobId]);

  async function createOrRefresh() {
    if (audience === "family" && password.trim().length < 4) {
      setError("Family shares need a password (at least 4 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password.trim() || undefined,
          expiresInDays: expiresDays ? Number(expiresDays) : undefined,
          audience,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        momentsGranted?: number;
      };
      if (!res.ok || !data.url) throw new Error(data.error || "Could not create share link");
      setUrl(data.url);
      if (data.momentsGranted && data.momentsGranted > 0) {
        setError(null);
        setCopied(false);
        // reuse error slot as soft success note
        setTimeout(() => {
          /* visual handled below via momentsNote */
        }, 0);
        setMomentsNote(`+${data.momentsGranted} Moments for family share`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    if (!url || !navigator.share) return;
    try {
      await navigator.share({
        title: "Memories Recap",
        text:
          audience === "family"
            ? "A family memory recap for you"
            : "Watch this memory recap",
        url,
      });
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="mt-8 space-y-4 border-t border-neutral-200 pt-6">
      <h2 className="text-xl font-medium tracking-tight text-neutral-900">Share</h2>
      <p className="text-sm text-neutral-500">
        Public link with a hard-to-guess token. Family mode requires a password
        so only close people can watch.
      </p>
      {url && viewCount > 0 ? (
        <p className="text-sm text-neutral-600">
          {viewCount} {viewCount === 1 ? "view" : "views"} so far
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["public", "Anyone with link"],
            ["family", "Family / close"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setAudience(value)}
            className={`min-h-11 rounded-xl px-3 text-sm ${
              audience === value
                ? "bg-neutral-900 text-white"
                : "bg-neutral-50 text-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            audience === "family"
              ? "Password (required, min 4)"
              : "Optional password"
          }
          className="h-11 flex-1 rounded-[12px] border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-green-600"
          minLength={audience === "family" ? 4 : undefined}
          required={audience === "family"}
        />
        <input
          type="number"
          min={1}
          max={365}
          value={expiresDays}
          onChange={(e) => setExpiresDays(e.target.value)}
          placeholder={audience === "family" ? "Expires (30d)" : "Expires in days"}
          className="h-11 w-full rounded-[12px] border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-green-600 sm:w-40"
        />
        <button
          type="button"
          onClick={() => void createOrRefresh()}
          disabled={busy}
          className="h-11 rounded-[16px] bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : url ? "Refresh link" : "Create link"}
        </button>
      </div>

      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={url}
            className="h-11 flex-1 rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="h-11 rounded-[16px] border border-neutral-200 bg-white px-4 text-sm font-medium"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="h-11 rounded-[16px] bg-green-700 px-4 text-sm font-medium text-white"
            >
              Share…
            </button>
          ) : null}
        </div>
      ) : null}

      {momentsNote ? (
        <p className="animate-float-up text-sm font-medium text-green-700">
          {momentsNote}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
