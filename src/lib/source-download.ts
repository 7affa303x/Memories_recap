import { get } from "@vercel/blob";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getServiceSupabase } from "@/lib/supabase/admin";

export function isBlobStoragePath(path: string) {
  return path.startsWith("blob:");
}

export function blobPathnameFromStorage(path: string) {
  return path.replace(/^blob:/, "");
}

export function toBlobStoragePath(pathname: string) {
  return `blob:${pathname.replace(/^blob:/, "")}`;
}

/** Download either a Vercel Blob object or a Supabase memories object. */
export async function downloadSourceToFile(path: string, dest: string) {
  if (isBlobStoragePath(path)) {
    const pathname = blobPathnameFromStorage(path);
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Blob download failed for ${pathname}`);
    }
    await pipeline(result.stream as never, createWriteStream(dest));
    return;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from("memories").download(path);
  if (error || !data) throw new Error(error?.message || "Download failed");
  await pipeline(
    Readable.fromWeb(data.stream() as never),
    createWriteStream(dest)
  );
}
