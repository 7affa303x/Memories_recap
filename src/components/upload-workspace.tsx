"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  estimateProcessingSeconds,
  formatBytes,
  MAX_FILES_PER_JOB,
} from "@/lib/types";

type LocalFile = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  uploadId?: string;
  error?: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function uploadWithProgress(
  file: File,
  signedUrl: string,
  onProgress: (pct: number) => void
) {
  const resumeKey = `upload-bytes:${file.name}:${file.size}:${file.lastModified}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
        sessionStorage.setItem(resumeKey, String(event.loaded));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        sessionStorage.setItem(`${resumeKey}:done`, "1");
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadWorkspace({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/billing/credits")
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.balance === "number") setBalance(j.balance);
      })
      .catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    const count = files.length;
    const bytes = files.reduce((sum, item) => sum + item.file.size, 0);
    const creditsRequired = Math.max(10, Math.ceil(bytes / (1024 * 1024)));
    return {
      count,
      bytes,
      estimate: estimateProcessingSeconds(bytes, count || 1),
      creditsRequired,
      enough: balance >= creditsRequired,
    };
  }, [files, balance]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list).filter((file) =>
      file.type.startsWith("video/")
    );
    if (incoming.length === 0) {
      setError("Please choose video files.");
      return;
    }
    setError(null);
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        const exists = next.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        );
        if (!exists) {
          next.push({
            id: createId(),
            file,
            progress: 0,
            status: "queued",
          });
        }
      }
      return next.slice(0, MAX_FILES_PER_JOB);
    });
  }, []);

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  async function startUpload() {
    if (files.length === 0) {
      setError("Add at least one video.");
      return;
    }
    if (!totals.enough) {
      setError(
        `Not enough credits. Need ${totals.creditsRequired}, you have ${balance}.`
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const createRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: files.map((item) => ({
              name: item.file.name,
              size: item.file.size,
              type: item.file.type,
            })),
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createJson.error || "Could not create job");
        }

        const jobId = createJson.job.id as string;

        for (const [index, item] of files.entries()) {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "uploading", progress: 0 }
                : entry
            )
          );

          const metaRes = await fetch(`/api/jobs/${jobId}/uploads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: item.file.name,
              size: item.file.size,
              type: item.file.type,
              sortOrder: index,
              resumeUploadId: item.uploadId,
            }),
          });
          const metaJson = await metaRes.json();
          if (!metaRes.ok) {
            throw new Error(metaJson.error || "Could not prepare upload");
          }

          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, uploadId: metaJson.upload?.id }
                : entry
            )
          );

          if (!metaJson.alreadyUploaded) {
            await uploadWithProgress(item.file, metaJson.signedUrl, (pct) => {
              setFiles((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, progress: pct, status: "uploading" }
                    : entry
                )
              );
            });
          }

          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, progress: 100, status: "done" }
                : entry
            )
          );
        }

        const processRes = await fetch(`/api/jobs/${jobId}/process`, {
          method: "POST",
        });
        const processJson = await processRes.json();
        if (processRes.status === 402) {
          throw new Error(
            `Not enough credits (need ${processJson.creditsRequired}). Buy credits first.`
          );
        }
        if (!processRes.ok) {
          throw new Error(processJson.error || "Could not start processing");
        }

        router.push(`/processing/${jobId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[16px] bg-neutral-50 p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-500">Your credits</span>
          <span className="font-medium">{balance}</span>
        </div>
        <p className="mt-2 text-neutral-500">
          1 credit ≈ 1 MB processed (min 10).{" "}
          <Link href="/pricing" className="text-green-700 underline">
            Buy credits
          </Link>
        </p>
      </div>

      <button
        type="button"
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex min-h-[220px] w-full flex-col items-center justify-center rounded-[16px] border border-dashed px-6 text-center transition ${
          dragOver
            ? "border-green-600 bg-green-50"
            : "border-neutral-300 bg-neutral-50"
        }`}
      >
        <p className="text-base font-medium text-neutral-900">
          Drag and drop videos
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          or tap to select · up to {MAX_FILES_PER_JOB} files · 2 GB total
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </button>

      {files.length > 0 ? (
        <div className="rounded-[16px] bg-neutral-50 p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-neutral-500">Videos</p>
              <p className="mt-1 font-medium">{totals.count}</p>
            </div>
            <div>
              <p className="text-neutral-500">Size</p>
              <p className="mt-1 font-medium">{formatBytes(totals.bytes)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Credits</p>
              <p className="mt-1 font-medium">{totals.creditsRequired}</p>
            </div>
            <div>
              <p className="text-neutral-500">Est. time</p>
              <p className="mt-1 font-medium">
                ~{Math.ceil(totals.estimate / 60)} min
              </p>
            </div>
          </div>
          {!totals.enough ? (
            <p className="mt-3 text-sm text-amber-700">
              You need {totals.creditsRequired - balance} more credits before
              processing.
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3">
        {files.map((item) => (
          <li
            key={item.id}
            className="rounded-[16px] bg-neutral-50 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatBytes(item.file.size)}
                  {item.status === "uploading"
                    ? ` · ${item.progress}%`
                    : item.status === "done"
                      ? " · uploaded"
                      : ""}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 text-sm text-neutral-500"
                onClick={() => removeFile(item.id)}
                disabled={isPending}
              >
                Remove
              </button>
            </div>
            {item.status === "uploading" || item.status === "done" ? (
              <div className="mt-3">
                <Progress value={item.progress} className="h-2" />
              </div>
            ) : null}
            {item.error ? (
              <p className="mt-2 text-sm text-red-600">{item.error}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        className="h-12 w-full rounded-[16px] text-base"
        disabled={isPending || files.length === 0}
        onClick={startUpload}
      >
        {isPending
          ? "Uploading…"
          : totals.enough
            ? `Create recap · ${totals.creditsRequired} credits`
            : "Buy credits to continue"}
      </Button>
      {!totals.enough && files.length > 0 ? (
        <Button asChild variant="secondary" className="h-12 w-full rounded-[16px]">
          <Link href="/pricing">Go to pricing</Link>
        </Button>
      ) : null}
    </div>
  );
}
