import { logError } from "@/lib/logger";

export async function register() {
  // Optional Sentry: set SENTRY_DSN to enable external error reporting later.
  if (process.env.SENTRY_DSN) {
    logError("sentry_dsn_configured", {
      note: "Install @sentry/nextjs and wire init if you want full Sentry.",
    });
  }
}
