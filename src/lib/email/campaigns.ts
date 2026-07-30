import { BRAND_NAME } from "@/lib/brand";
import { getAppUrl } from "@/lib/billing/config";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getBillingSummary } from "@/lib/billing/credits";
import { listJobsForUser } from "@/lib/store";

type Tracker = {
  lastReengagementAt?: string;
  lastReviewJobIds?: string[];
  lastDiscountAt?: string;
  lastNudgeAt?: string;
};

async function readTracker(userId: string): Promise<Tracker> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from("app-data")
      .download(`email-tracking/${userId}.json`);
    if (error || !data) return {};
    return JSON.parse(await data.text()) as Tracker;
  } catch {
    return {};
  }
}

async function writeTracker(userId: string, tracker: Tracker) {
  const supabase = getServiceSupabase();
  await supabase.storage.from("app-data").upload(
    `email-tracking/${userId}.json`,
    JSON.stringify(tracker),
    { contentType: "application/json", upsert: true }
  );
}

async function sendHtml(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || `${BRAND_NAME} <onboarding@resend.dev>`;
  if (!key) return { ok: false as const, skipped: true as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) return { ok: false as const, skipped: false as const };
  return { ok: true as const, skipped: false as const };
}

function daysSince(iso?: string) {
  if (!iso) return 999;
  return Math.floor(
    (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)
  );
}

async function listKnownUserIds(): Promise<string[]> {
  const supabase = getServiceSupabase();
  const { data } = await supabase.storage.from("app-data").list("users", {
    limit: 1000,
  });
  return (data || [])
    .map((row) => row.name?.replace(/\.json$/, ""))
    .filter((id): id is string => Boolean(id));
}

/**
 * Daily engagement drip (runs inside the existing Hobby cron).
 * - Re-engage idle users
 * - Ask for a 1–5 rating after completed recaps
 * - Soft discount nudge when credits are low
 */
export async function runEmailCampaigns(limit = 40) {
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true as const, sent: 0, scanned: 0 };
  }

  const appUrl = getAppUrl();
  const userIds = (await listKnownUserIds()).slice(0, limit);
  let sent = 0;

  for (const userId of userIds) {
    try {
      const supabase = getServiceSupabase();
      const { data } = await supabase.storage
        .from("app-data")
        .download(`users/${userId}.json`);
      if (!data) continue;
      const user = JSON.parse(await data.text()) as {
        id: string;
        email?: string;
        name?: string | null;
      };
      if (!user.email) continue;

      const tracker = await readTracker(userId);
      const jobs = await listJobsForUser(userId);
      const completed = jobs.filter((j) => j.status === "completed");
      const latestJob = jobs[0];
      const name = user.name || "there";

      // Review request: completed recap 1–7 days ago, not yet asked
      const reviewCandidate = completed.find((j) => {
        const age = daysSince(j.completed_at || j.updated_at);
        return age >= 1 && age <= 10;
      });
      const asked = new Set(tracker.lastReviewJobIds || []);
      if (reviewCandidate && !asked.has(reviewCandidate.id)) {
        const result = await sendHtml({
          to: user.email,
          subject: `How was your ${BRAND_NAME}?`,
          html: `
            <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717;max-width:560px">
              <h1 style="font-size:22px;color:#166534">${BRAND_NAME}</h1>
              <p>Hi ${name},</p>
              <p>Your recap is ready to revisit. A quick 1–5 rating helps us pick better moments next time.</p>
              <p><a href="${appUrl}/result/${reviewCandidate.id}" style="display:inline-block;background:#166534;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Rate your recap</a></p>
            </div>`,
        });
        if (result.ok) {
          sent += 1;
          tracker.lastReviewJobIds = [
            ...(tracker.lastReviewJobIds || []),
            reviewCandidate.id,
          ].slice(-30);
          await writeTracker(userId, tracker);
          continue;
        }
      }

      // Re-engagement: no activity ~7+ days
      const idleDays = daysSince(latestJob?.updated_at || latestJob?.created_at);
      if (
        idleDays >= 7 &&
        daysSince(tracker.lastReengagementAt) >= 14 &&
        completed.length === 0
      ) {
        const result = await sendHtml({
          to: user.email,
          subject: `Still holding onto those clips?`,
          html: `
            <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717;max-width:560px">
              <h1 style="font-size:22px;color:#166534">${BRAND_NAME}</h1>
              <p>Hi ${name},</p>
              <p>Your free credits are waiting. Upload a few phone videos and we’ll turn them into one calm shareable recap.</p>
              <p><a href="${appUrl}/upload" style="display:inline-block;background:#166534;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Upload memories</a></p>
            </div>`,
        });
        if (result.ok) {
          sent += 1;
          tracker.lastReengagementAt = new Date().toISOString();
          await writeTracker(userId, tracker);
          continue;
        }
      }

      // Soft discount / credits nudge when balance low after a completed recap
      if (completed.length > 0 && daysSince(tracker.lastDiscountAt) >= 21) {
        const summary = await getBillingSummary(userId, user.email);
        if (summary.balance < 40) {
          const result = await sendHtml({
            to: user.email,
            subject: `Keep the stories going — credits top-up`,
            html: `
              <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717;max-width:560px">
                <h1 style="font-size:22px;color:#166534">${BRAND_NAME}</h1>
                <p>Hi ${name},</p>
                <p>You’re low on Moments. Invite a friend, keep your streak, or top up a quiet pack when you’re ready — no rush.</p>
                <p><a href="${appUrl}/moments" style="display:inline-block;background:#166534;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Earn Moments</a></p>
              </div>`,
          });
          if (result.ok) {
            sent += 1;
            tracker.lastDiscountAt = new Date().toISOString();
            await writeTracker(userId, tracker);
          }
        }
      }
    } catch {
      /* continue */
    }
  }

  return { skipped: false as const, sent, scanned: userIds.length };
}
