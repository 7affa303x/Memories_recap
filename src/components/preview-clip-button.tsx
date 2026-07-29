"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function PreviewClipButton({
  jobId,
  initialUrl,
}: {
  jobId: string;
  initialUrl?: string | null;
}) {
  const [url, setUrl] = useState(initialUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}/preview`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not make preview");
        return;
      }
      setUrl(json.previewUrl);
    });
  }

  return (
    <div className="space-y-2">
      {url ? (
        <Button asChild variant="secondary" className="h-11 w-full rounded-[16px] bg-white text-sm shadow-sm">
          <a href={url} download target="_blank" rel="noreferrer">
            Download 6s preview
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full rounded-[16px] bg-white text-sm shadow-sm"
          disabled={pending}
          onClick={generate}
        >
          {pending ? "Making preview…" : "Make 6s preview clip"}
        </Button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
