"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { estimateProcessingSeconds, formatBytes } from "@/lib/types";
import {
  formatLimitHint,
  isLikelyVideoFile,
  MAX_FILES_PER_JOB,
  validateLocalVideoBatch,
} from "@/lib/media";

type LocalFile = {
  id: string;
  file: File;
  previewUrl: string;
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
  contentType: string,
  onProgress: (pct: number) => void
) {
  const resumeKey = `upload-bytes:${file.name}:${file.size}:${file.lastModified}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", contentType || "video/mp4");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.timeout = 30 * 60 * 1000;
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
        const body = (xhr.responseText || "").toLowerCase();
        if (
          xhr.status === 413 ||
          body.includes("maximum allowed size") ||
          body.includes("entitytoo large") ||
          body.includes("payload too large")
        ) {
          reject(
            new Error(
              "This clip is larger than the small-file storage lane (~50 MB). We’ll retry on the large-file lane — tap Create again."
            )
          );
          return;
        }
        reject(
          new Error(
            `Upload paused at the network (${xhr.status}). Keep this tab open and try again — large clips sometimes need a second pass.`
          )
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Network hiccup while uploading. Check your connection and try again — we kept your selection."
        )
      );
    xhr.ontimeout = () =>
      reject(
        new Error(
          "That upload took too long on this connection. Try Wi‑Fi or a slightly smaller clip."
        )
      );
    xhr.send(file);
  });
}

async function uploadViaBlob(
  file: File,
  pathname: string,
  jobId: string,
  userIdHint: string,
  contentType: string,
  onProgress: (pct: number) => void
) {
  const { upload } = await import("@vercel/blob/client");
  await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload",
    multipart: true,
    contentType: contentType || "video/mp4",
    clientPayload: JSON.stringify({ userId: userIdHint, jobId }),
    onUploadProgress: ({ percentage }) => {
      onProgress(Math.max(1, Math.min(99, Math.round(percentage))));
    },
  });
  onProgress(100);
}

type MusicTrackOption = {
  id: string;
  title: string;
  mood: string;
  vibe: string;
  previewUrl: string;
};

export function UploadWorkspace({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const filesRef = useRef<LocalFile[]>([]);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [isPending, startTransition] = useTransition();
  const [musicMode, setMusicMode] = useState<"none" | "manual" | "auto">(
    "auto"
  );
  const [mood, setMood] = useState("joyful");
  const [trackId, setTrackId] = useState<string>("");
  const [tracks, setTracks] = useState<MusicTrackOption[]>([]);
  const [moods, setMoods] = useState<Array<{ id: string; label: string }>>([]);
  const [dailyNote, setDailyNote] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [outputQuality, setOutputQuality] = useState<"fhd" | "uhd">("fhd");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  useEffect(() => {
    fetch("/api/billing/credits")
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.balance === "number") setBalance(j.balance);
        if (j.dailyLoginGrantedToday && j.dailyLoginAmount) {
          setDailyNote(`+${j.dailyLoginAmount} daily credits ready for you`);
        }
        const status = j.subscription?.status as string | undefined;
        setIsPro(status === "active" || status === "trialing");
      })
      .catch(() => undefined);
    fetch("/api/music")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.tracks)) setTracks(j.tracks);
        if (Array.isArray(j.moods)) setMoods(j.moods);
        if (j.tracks?.[0]?.id) setTrackId((prev) => prev || j.tracks[0].id);
      })
      .catch(() => undefined);
    fetch("/api/prefs")
      .then((r) => r.json())
      .then((p) => {
        if (p.defaultMood) setMood(p.defaultMood);
        if (p.defaultMusicMode) setMusicMode(p.defaultMusicMode);
        if (p.defaultTrackId) setTrackId(p.defaultTrackId);
        if (p.defaultOutputQuality) setOutputQuality(p.defaultOutputQuality);
        if (p.lastFolder) setFolder(p.lastFolder);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      for (const item of filesRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const previewTrack = useMemo(() => {
    if (musicMode === "none" || tracks.length === 0) return null;
    if (musicMode === "manual") {
      return tracks.find((t) => t.id === trackId) || tracks[0] || null;
    }
    return (
      tracks.find((t) => t.mood === mood) ||
      tracks[0] ||
      null
    );
  }, [musicMode, trackId, tracks, mood]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setMusicPlaying(false);
    if (previewTrack?.previewUrl) {
      audio.src = previewTrack.previewUrl;
      audio.load();
    } else {
      audio.removeAttribute("src");
    }
  }, [previewTrack?.id, previewTrack?.previewUrl]);

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

  const previewFile = useMemo(
    () => files.find((f) => f.id === previewId) || null,
    [files, previewId]
  );

  const addFiles = useCallback((list: FileList | File[]) => {
    const raw = Array.from(list);
    const incoming = raw.filter((file) =>
      isLikelyVideoFile(file.name, file.type)
    );
    if (incoming.length === 0) {
      setError(
        "Please choose video files from your gallery (mp4, mov, m4v…)."
      );
      return;
    }

    setFiles((current) => {
      const next = [...current];
      const skipped: string[] = [];
      for (const file of incoming) {
        const exists = next.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        );
        if (exists) continue;
        if (next.length >= MAX_FILES_PER_JOB) {
          skipped.push("count");
          break;
        }
        const check = validateLocalVideoBatch([
          ...next.map((n) => n.file),
          file,
        ]);
        if (!check.ok) {
          skipped.push(check.error);
          continue;
        }
        next.push({
          id: createId(),
          file,
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: "queued",
        });
      }
      if (skipped.length) {
        const msg = skipped.find((s) => s !== "count") ||
          `Take your time — up to ${MAX_FILES_PER_JOB} videos works best.`;
        setError(msg);
      } else {
        setError(null);
      }
      return next;
    });
  }, []);

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    if (previewId === id) setPreviewId(null);
  }

  function toggleMusicPreview() {
    const audio = audioRef.current;
    if (!audio || !previewTrack) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
      return;
    }
    void audio
      .play()
      .then(() => setMusicPlaying(true))
      .catch(() =>
        setError("Couldn’t play the preview — tap again or check device sound.")
      );
  }

  async function startUpload() {
    if (files.length === 0) {
      setError("Add at least one video.");
      return;
    }
    const localCheck = validateLocalVideoBatch(files.map((f) => f.file));
    if (!localCheck.ok) {
      setError(localCheck.error);
      return;
    }
    if (!totals.enough) {
      setError(
        `Not enough credits yet. Need ${totals.creditsRequired}, you have ${balance}. We’ll wait — grab a pack when you’re ready.`
      );
      return;
    }

    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setMusicPlaying(false);
    }

    startTransition(async () => {
      try {
        const createRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: files.map((item) => ({
              name: item.file.name,
              size: item.file.size,
              type: item.file.type || "video/mp4",
            })),
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) {
          throw new Error(
            createJson.error ||
              "We couldn’t start this batch. Try again in a moment."
          );
        }

        const jobId = createJson.job.id as string;
        const userId = createJson.job.user_id as string;

        for (const [index, item] of files.entries()) {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "uploading", progress: 0 }
                : entry
            )
          );

          const mime = item.file.type || "video/mp4";
          const metaRes = await fetch(`/api/jobs/${jobId}/uploads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: item.file.name,
              size: item.file.size,
              type: mime,
              sortOrder: index,
              resumeUploadId: item.uploadId,
            }),
          });
          const metaJson = await metaRes.json();
          if (!metaRes.ok) {
            throw new Error(
              metaJson.error ||
                `Couldn’t prepare “${item.file.name}”. Try picking it again.`
            );
          }

          if (metaJson.alreadyUploaded) {
            setFiles((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      uploadId: metaJson.upload?.id,
                      progress: 100,
                      status: "done",
                    }
                  : entry
              )
            );
            continue;
          }

          if (metaJson.provider === "blob") {
            const pathname = metaJson.blobPathname as string;
            await uploadViaBlob(
              item.file,
              pathname,
              jobId,
              userId,
              mime,
              (pct) => {
                setFiles((current) =>
                  current.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, progress: pct, status: "uploading" }
                      : entry
                  )
                );
              }
            );
            const finalizeRes = await fetch(`/api/jobs/${jobId}/uploads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: item.file.name,
                size: item.file.size,
                type: mime,
                sortOrder: index,
                blobPathname: pathname,
              }),
            });
            const finalizeJson = await finalizeRes.json();
            if (!finalizeRes.ok) {
              throw new Error(
                finalizeJson.error || "Couldn’t finalize large upload"
              );
            }
            setFiles((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      uploadId: finalizeJson.upload?.id,
                      progress: 100,
                      status: "done",
                    }
                  : entry
              )
            );
            continue;
          }

          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, uploadId: metaJson.upload?.id }
                : entry
            )
          );

          await uploadWithProgress(
            item.file,
            metaJson.signedUrl,
            mime,
            (pct) => {
              setFiles((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, progress: pct, status: "uploading" }
                    : entry
                )
              );
            }
          );

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            musicMode,
            mood,
            trackId: musicMode === "manual" ? trackId : null,
            outputQuality: isPro ? outputQuality : "fhd",
            folder: folder.trim() || null,
          }),
        });
        fetch("/api/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultMood: mood,
            defaultMusicMode: musicMode,
            defaultTrackId: musicMode === "manual" ? trackId : null,
            defaultOutputQuality: isPro ? outputQuality : "fhd",
            lastFolder: folder.trim() || null,
          }),
        }).catch(() => undefined);
        const processJson = await processRes.json();
        if (processRes.status === 402) {
          throw new Error(
            `Need ${processJson.creditsRequired} credits for this batch. Buy a pack, then we’ll pick up right here.`
          );
        }
        if (!processRes.ok) {
          throw new Error(
            processJson.error || "Could not start processing — try again."
          );
        }

        router.push(`/processing/${jobId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={() => setMusicPlaying(false)}
        className="hidden"
      />

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
        {dailyNote ? (
          <p className="mt-1 text-green-700">{dailyNote}</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-[16px] bg-neutral-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-neutral-900">Recap style</p>
        <label className="block text-sm text-neutral-500">
          Folder (optional)
          <input
            className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
            placeholder="Wedding · Trip · Family"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-4">
          {moods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMood(m.id)}
              className={`min-h-11 rounded-xl px-3 text-sm ${
                mood === m.id
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="pt-1 text-sm font-medium text-neutral-900">Music</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["auto", "Auto"],
              ["manual", "Choose"],
              ["none", "No music"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMusicMode(value)}
              className={`min-h-11 rounded-xl px-3 text-sm ${
                musicMode === value
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {musicMode === "manual" ? (
          <select
            className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
          >
            {tracks
              .filter((t) => t.mood === mood)
              .concat(tracks.filter((t) => t.mood !== mood))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.vibe}
                </option>
              ))}
          </select>
        ) : null}
        {previewTrack && musicMode !== "none" ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">
                {musicMode === "auto" ? "Auto pick · " : ""}
                {previewTrack.title}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {previewTrack.vibe} · tap play to hear it
              </p>
            </div>
            <button
              type="button"
              onClick={toggleMusicPreview}
              className="h-11 shrink-0 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white"
            >
              {musicPlaying ? "Pause" : "Play"}
            </button>
          </div>
        ) : null}
        <p className="text-xs text-neutral-500">
          Mostly soundless under the track — big laughs and cheers stay.
        </p>
        {isPro ? (
          <div className="pt-2">
            <p className="text-sm font-medium text-neutral-900">Output</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOutputQuality("fhd")}
                className={`min-h-11 rounded-xl px-3 text-sm ${
                  outputQuality === "fhd"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700"
                }`}
              >
                Full HD
              </button>
              <button
                type="button"
                onClick={() => setOutputQuality("uhd")}
                className={`min-h-11 rounded-xl px-3 text-sm ${
                  outputQuality === "uhd"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700"
                }`}
              >
                4K UHD
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              4K keeps more detail from phone footage. Takes longer to render.
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            Output is Full HD. Pro unlocks 4K and removes the overlay watermark.
          </p>
        )}
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
        className={`flex min-h-[200px] w-full flex-col items-center justify-center rounded-[16px] border border-dashed px-6 text-center transition ${
          dragOver
            ? "border-green-600 bg-green-50"
            : "border-neutral-300 bg-neutral-50"
        }`}
      >
        <p className="text-base font-medium text-neutral-900">
          Choose videos from your gallery
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          or drag and drop · {formatLimitHint()}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.3gp"
          multiple
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
              processing — no rush.
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Clear cost: {totals.creditsRequired} credits · ~{" "}
              {Math.ceil(totals.estimate / 60)} min · tap a thumbnail to confirm
              each clip.
            </p>
          )}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((item) => (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => setPreviewId(item.id)}
                className="group relative block w-full overflow-hidden rounded-[16px] bg-neutral-900 shadow-sm"
                aria-label={`Preview ${item.file.name}`}
              >
                <video
                  src={item.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-square w-full object-cover opacity-95 transition group-hover:opacity-100"
                  onLoadedMetadata={(e) => {
                    try {
                      e.currentTarget.currentTime = 0.1;
                    } catch {
                      /* ignore seek */
                    }
                  }}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-left">
                  <span className="block truncate text-xs font-medium text-white">
                    {item.file.name}
                  </span>
                  <span className="text-[11px] text-white/80">
                    {formatBytes(item.file.size)}
                    {item.status === "uploading"
                      ? ` · ${item.progress}%`
                      : item.status === "done"
                        ? " · uploaded"
                        : " · tap to play"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="absolute right-2 top-2 min-h-9 min-w-9 rounded-full bg-black/55 text-sm text-white"
                onClick={() => removeFile(item.id)}
                disabled={isPending}
                aria-label="Remove video"
              >
                ×
              </button>
              {item.status === "uploading" || item.status === "done" ? (
                <div className="mt-2 px-1">
                  <Progress value={item.progress} className="h-1.5" />
                </div>
              ) : null}
              {item.error ? (
                <p className="mt-1 text-xs text-red-600">{item.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        className="h-12 w-full rounded-[16px] text-base"
        disabled={isPending || files.length === 0}
        onClick={startUpload}
      >
        {isPending
          ? "Uploading with care…"
          : totals.enough
            ? `Create recap · ${totals.creditsRequired} credits`
            : "Buy credits to continue"}
      </Button>
      {!totals.enough && files.length > 0 ? (
        <Button
          asChild
          variant="secondary"
          className="h-12 w-full rounded-[16px]"
        >
          <Link href="/pricing">Go to pricing</Link>
        </Button>
      ) : null}

      {previewFile ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Video preview"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[20px] bg-neutral-950 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={previewFile.id}
              src={previewFile.previewUrl}
              className="aspect-video w-full bg-black"
              controls
              playsInline
              autoPlay
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {previewFile.file.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatBytes(previewFile.file.size)} · confirm it’s the right
                  clip
                </p>
              </div>
              <button
                type="button"
                className="h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-medium text-neutral-900"
                onClick={() => setPreviewId(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
