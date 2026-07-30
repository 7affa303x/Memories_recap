import { describe, expect, it } from "vitest";
import { toFriendlyProcessError } from "@/lib/pipeline/errors";
import { SCORING_CONFIG, PIPELINE_STAGES } from "@/lib/pipeline/types";

describe("toFriendlyProcessError", () => {
  it("hides drawtext / ffmpeg stderr from users", () => {
    const raw = `[AVFilterGraph] No such filter: 'drawtext'\nError opening output file /tmp/memory-recap-x/end-landscape.mp4`;
    const friendly = toFriendlyProcessError(new Error(raw));
    expect(friendly.code).toBe("ffmpeg_drawtext");
    expect(friendly.userMessage.toLowerCase()).not.toContain("drawtext");
    expect(friendly.userMessage.toLowerCase()).not.toContain("/tmp/");
    expect(friendly.retryable).toBe(true);
  });

  it("maps timeout language", () => {
    const friendly = toFriendlyProcessError(new Error("Processing timed out (stuck recovery)"));
    expect(friendly.code).toBe("timeout");
    expect(friendly.retryable).toBe(true);
  });

  it("maps disk exhaustion", () => {
    const friendly = toFriendlyProcessError(new Error("ENOSPC: no space left on device"));
    expect(friendly.code).toBe("disk_full");
  });

  it("keeps short human messages", () => {
    const friendly = toFriendlyProcessError(new Error("No videos uploaded"));
    expect(friendly.code).toBe("no_uploads");
    expect(friendly.retryable).toBe(false);
  });
});

describe("pipeline contracts", () => {
  it("exposes stable scoring config", () => {
    expect(SCORING_CONFIG.prompt_id).toBe("memory-frame-v1");
    expect(PIPELINE_STAGES).toContain("timeline_ready");
    expect(PIPELINE_STAGES).toContain("scored");
  });
});
