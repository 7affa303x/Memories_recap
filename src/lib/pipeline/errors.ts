/**
 * Map raw FFmpeg / platform errors to user-safe copy.
 * Full technical detail stays in logs only.
 */

export type FriendlyProcessError = {
  code: string;
  userMessage: string;
  retryable: boolean;
};

export function toFriendlyProcessError(
  raw: unknown
): FriendlyProcessError {
  const message = raw instanceof Error ? raw.message : String(raw ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("no such filter: 'drawtext'") ||
    lower.includes("no such filter: drawtext") ||
    lower.includes("drawtext")
  ) {
    return {
      code: "ffmpeg_drawtext",
      userMessage:
        "We hit a branding glitch while finishing your recap. Credits are back — retry and we’ll use the safe path.",
      retryable: true,
    };
  }

  if (
    lower.includes("enospc") ||
    lower.includes("no space") ||
    lower.includes("disk")
  ) {
    return {
      code: "disk_full",
      userMessage:
        "This batch was too heavy for our processing disk. Try fewer or shorter clips, then retry.",
      retryable: true,
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("maxduration") ||
    lower.includes("killed") ||
    lower.includes("sigkill")
  ) {
    return {
      code: "timeout",
      userMessage:
        "Processing ran past our time window. Split into a smaller batch so we can finish cleanly.",
      retryable: true,
    };
  }

  if (
    lower.includes("blob download failed") ||
    lower.includes("download failed") ||
    lower.includes("large video storage isn’t ready")
  ) {
    return {
      code: "source_download",
      userMessage:
        "We couldn’t fetch one of your uploads. Check the file is still available, then retry.",
      retryable: true,
    };
  }

  if (
    lower.includes("insufficient_credits") ||
    lower.includes("not enough credits")
  ) {
    return {
      code: "credits",
      userMessage: "Not enough credits for this recap. Top up on Pricing, then retry.",
      retryable: false,
    };
  }

  if (lower.includes("ffmpeg binary missing") || lower.includes("ffmpeg")) {
    // Generic ffmpeg — don't dump stderr
    if (message.length > 180 || lower.includes("libav") || lower.includes("[vost")) {
      return {
        code: "ffmpeg_failed",
        userMessage:
          "Video encoding failed on our side. Credits are back — retry, or try a shorter clip if it happens again.",
        retryable: true,
      };
    }
  }

  if (lower.includes("no videos uploaded")) {
    return {
      code: "no_uploads",
      userMessage: "Add at least one video before processing.",
      retryable: false,
    };
  }

  if (lower.includes("lease") || lower.includes("encode_slot")) {
    return {
      code: "busy",
      userMessage:
        "We’re finishing other recaps first. Yours stays queued — no need to retry yet.",
      retryable: true,
    };
  }

  // Never expose huge stderr dumps in the UI
  const trimmed =
    message.length > 220 ? `${message.slice(0, 200).trim()}…` : message;
  const looksTechnical =
    /libav|filtergraph|stderr|0x[0-9a-f]+|\/tmp\/|\/var\/task/i.test(message);

  return {
    code: "process_failed",
    userMessage: looksTechnical
      ? "Something went wrong while crafting this recap. Credits are back — tap retry when you’re ready."
      : trimmed ||
        "Something went wrong while crafting this recap. Credits are back — tap retry when you’re ready.",
    retryable: true,
  };
}
