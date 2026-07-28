"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load(pwd?: string) {
    setError(null);
    const q = pwd ? `?password=${encodeURIComponent(pwd)}` : "";
    const res = await fetch(`/api/share/${token}${q}`, { cache: "no-store" });
    const json = await res.json();
    if (res.status === 401 && json.passwordRequired) {
      setNeedsPassword(true);
      return;
    }
    if (!res.ok) {
      setError(json.error || "This link is unavailable");
      return;
    }
    setNeedsPassword(false);
    setData({
      title: json.title,
      landscapeUrl: json.landscapeUrl,
      verticalUrl: json.verticalUrl,
    });
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
          <div className="space-y-3 rounded-[16px] bg-neutral-50 p-4">
            <p className="text-sm text-neutral-600">This link is password protected.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Password"
            />
            <Button
              className="h-11 w-full rounded-[16px]"
              onClick={() => load(password)}
            >
              Unlock
            </Button>
          </div>
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
      </section>
    </main>
  );
}
