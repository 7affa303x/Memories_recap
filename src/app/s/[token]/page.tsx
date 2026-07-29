"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const SHARE_PWD_KEY = (token: string) => `share-pwd:${token}`;

export default function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    title: string;
    landscapeUrl: string;
    verticalUrl: string | null;
  } | null>(null);

  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let saved: string | undefined;
    try {
      saved = sessionStorage.getItem(SHARE_PWD_KEY(token)) || undefined;
    } catch {
      saved = undefined;
    }
    if (saved) setPassword(saved);
    void load(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load(pwd?: string) {
    setError(null);
    const hasPwd = Boolean(pwd && pwd.length > 0);
    const res = await fetch(`/api/share/${token}`, {
      method: hasPwd ? "POST" : "GET",
      cache: "no-store",
      headers: hasPwd ? { "Content-Type": "application/json" } : undefined,
      body: hasPwd ? JSON.stringify({ password: pwd }) : undefined,
    });
    const json = await res.json();
    if (res.status === 401 && json.passwordRequired) {
      setNeedsPassword(true);
      return;
    }
    if (!res.ok) {
      setError(json.error || "This link is unavailable");
      return;
    }
    if (pwd) {
      try {
        sessionStorage.setItem(SHARE_PWD_KEY(token), pwd);
      } catch {
        /* ignore */
      }
    }
    setNeedsPassword(false);
    setData({
      title: json.title,
      landscapeUrl: json.landscapeUrl,
      verticalUrl: json.verticalUrl,
    });
  }

  function onUnlock(e: FormEvent) {
    e.preventDefault();
    void load(password);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header>
        <Logo />
      </header>

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {data?.title || "Shared recap"}
          </h1>
          <p className="mt-2 text-neutral-500">A calm cut of the memories.</p>
        </div>

        {needsPassword && !data ? (
          <form
            onSubmit={onUnlock}
            className="space-y-3 rounded-[16px] bg-neutral-50 p-4"
          >
            <p className="text-sm text-neutral-600">
              This link is password protected.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Password"
              autoComplete="current-password"
            />
            <Button type="submit" className="h-11 w-full rounded-[16px]">
              Unlock
            </Button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {data ? (
          <>
            <div className="overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
              <video
                className="aspect-video w-full bg-black"
                src={data.landscapeUrl}
                controls
                playsInline
                preload="metadata"
              />
            </div>
            {data.verticalUrl ? (
              <div className="mx-auto max-w-[280px] overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
                <video
                  className="aspect-[9/16] w-full bg-black"
                  src={data.verticalUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : null}
            <div className="grid gap-3">
              <Button asChild className="h-12 rounded-[16px]">
                <a href={data.landscapeUrl} target="_blank" rel="noreferrer">
                  Open landscape
                </a>
              </Button>
              {data.verticalUrl ? (
                <Button asChild variant="secondary" className="h-12 rounded-[16px]">
                  <a href={data.verticalUrl} target="_blank" rel="noreferrer">
                    Open vertical
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="border-t border-neutral-200 pt-6">
          <Button asChild className="h-12 w-full rounded-[16px] text-base">
            <Link href="/">Make your own recap</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
