import { BRAND_NAME } from "@/lib/brand";
import { getAppUrl } from "@/lib/billing/config";
import { getServiceSupabase } from "@/lib/supabase/admin";

type WelcomeEmail = {
  to: string;
  name?: string | null;
  userId?: string;
};

async function claimWelcomeSend(userId: string) {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.storage.from("app-data").upload(
      `email-locks/welcome-${userId}.json`,
      JSON.stringify({ userId, at: new Date().toISOString() }),
      { contentType: "application/json", upsert: false }
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * First-sign-in welcome email. No-ops unless RESEND_API_KEY is set.
 * When userId is provided, sends at most once per account (storage lock).
 */
export async function sendWelcomeEmail(input: WelcomeEmail) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || `${BRAND_NAME} <onboarding@resend.dev>`;

  if (!key) {
    console.info(
      JSON.stringify({
        level: "info",
        message: "welcome_email_skipped_no_resend_key",
        to: input.to,
      })
    );
    return { ok: false as const, skipped: true as const };
  }

  if (input.userId) {
    const first = await claimWelcomeSend(input.userId);
    if (!first) {
      return {
        ok: false as const,
        skipped: true as const,
        reason: "already_sent" as const,
      };
    }
  }

  const appUrl = getAppUrl();
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Welcome to ${BRAND_NAME}`,
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717">
            <h1 style="font-size:22px;margin:0 0 12px">${BRAND_NAME}</h1>
            <p>${greeting}</p>
            <p>Thanks for joining. Upload a few clips and we’ll turn them into a short, watchable recap.</p>
            <p><a href="${appUrl}/upload" style="display:inline-block;background:#15803d;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Make your first recap</a></p>
            <p style="color:#737373;font-size:13px">If the button does not work, open:<br/>${appUrl}/upload</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        JSON.stringify({
          level: "error",
          message: "welcome_email_send_failed",
          status: res.status,
          text: text.slice(0, 300),
        })
      );
      return { ok: false as const, skipped: false as const };
    }

    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "welcome_email_exception",
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return { ok: false as const, skipped: false as const };
  }
}
