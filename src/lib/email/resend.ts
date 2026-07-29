/**
 * Resend Email Service for Memory Recap
 * 
 * Handles all email sending: transactional, engagement, and promotional.
 * Uses Resend API for reliable delivery.
 */

export const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
export const FROM_EMAIL = "Memories Recap <noreply@memoryrecap.app>";
export const APP_NAME = "Memory Recap";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function sendEmail(options: EmailOptions): Promise<{ id: string } | null> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured — email skipped");
    return null;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo || "haffa303@gmail.com",
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend API error:", error);
      return null;
    }

    const data = (await res.json()) as { id: string };
    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
    return null;
  }
}

/**
 * Welcome email for new users.
 */
export async function sendWelcomeEmail(to: string, name?: string | null) {
  const displayName = name || "friend";
  return sendEmail({
    to,
    subject: "Welcome to Memory Recap ✨",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">Welcome to Memory Recap!</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${displayName},<br/><br/>
          Your free <strong>200 credits</strong> are ready. Start by uploading your memory videos — 
          we'll turn hours of footage into one calm, shareable recap.<br/><br/>
          <a href="https://memories-recap-one.vercel.app/upload" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Upload your memories
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}

/**
 * Job completion notification.
 */
export async function sendJobCompletedEmail(to: string, jobId: string, videoCount: number) {
  return sendEmail({
    to,
    subject: "Your Memory Recap is ready! 🎬",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">Your recap is ready!</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We've picked the best moments from your ${videoCount} video${videoCount > 1 ? "s" : ""} 
          and created a beautiful recap — landscape for watching, vertical for sharing.<br/><br/>
          <a href="https://memories-recap-one.vercel.app/result/${jobId}" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Watch your recap
          </a>
        </p>
        <p style="color: #555; font-size: 14px; margin-top: 20px;">
          <strong>Share it:</strong> Create a public link from your dashboard to share with family and friends.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}

/**
 * Re-engagement email for inactive users (sent after 7 days without activity).
 */
export async function sendReengagementEmail(to: string, name?: string | null) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "We miss your memories, ${displayName}",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">Come back to Memory Recap</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${displayName},<br/><br/>
          It's been a while since your last recap. Your memories deserve to be turned into 
          something beautiful — shareable, watchable, and ready to post.<br/><br/>
          <a href="https://memories-recap-one.vercel.app/upload" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Create a new recap
          </a>
        </p>
        <p style="color: #555; font-size: 14px; margin-top: 20px;">
          <strong>Tip:</strong> The more videos you upload, the better your recap looks!
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}

/**
 * Review/rating request email (sent 3 days after job completion).
 */
export async function sendReviewRequestEmail(to: string, jobId: string) {
  return sendEmail({
    to,
    subject: "How was your Memory Recap? ⭐",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">We'd love your feedback!</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Your recap has been ready for a few days. How did it turn out?<br/><br/>
          Your feedback helps us make Memory Recap better for everyone.<br/><br/>
          <a href="https://memories-recap-one.vercel.app/result/${jobId}" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Watch & rate your recap
          </a>
        </p>
        <p style="color: #555; font-size: 14px; margin-top: 20px;">
          Reply to this email if you have any suggestions — we read every one.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}

/**
 * Discount/promotion email for inactive users with expired credits.
 */
export async function sendDiscountEmail(to: string, name?: string | null) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "20% off credits — welcome back deal 🎉",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">Welcome back deal!</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${displayName},<br/><br/>
          We noticed your credits have been sitting unused. Here's a special offer 
          to help you create your next recap:<br/><br/>
          <strong style="font-size: 20px; color: #166534;">20% off any credit pack</strong><br/>
          Use code: <strong style="background: #f0fdf4; padding: 4px 8px; border-radius: 6px; font-family: monospace;">WELCOME20</strong><br/><br/>
          <a href="https://memories-recap-one.vercel.app/pricing" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Get your credits
          </a>
        </p>
        <p style="color: #555; font-size: 13px; margin-top: 16px;">
          Valid for 7 days. Cannot be combined with other offers.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}

/**
 * Weekly digest email showing user stats.
 */
export async function sendWeeklyDigestEmail(
  to: string,
  name: string | null,
  stats: { totalRecaps: number; lastWeekRecaps: number; creditsRemaining: number }
) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "Your Memory Recap Weekly Digest 📊",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="color: #166534; font-size: 28px;">Your Weekly Digest</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${displayName}, here's your week in Memory Recap:<br/><br/>
        </p>
        <div style="background: #f8faf9; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #737373;">Total recaps created</span>
            <span style="font-weight: 600; color: #166534;">${stats.totalRecaps}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #737373;">Recaps this week</span>
            <span style="font-weight: 600; color: #166534;">${stats.lastWeekRecaps}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #737373;">Credits remaining</span>
            <span style="font-weight: 600; color: #166534;">${stats.creditsRemaining}</span>
          </div>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          ${stats.creditsRemaining < 50 
            ? "Your credits are running low! Grab a pack to keep creating recaps." 
            : "Ready to create more beautiful recaps?"}<br/><br/>
          <a href="https://memories-recap-one.vercel.app/upload" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Create your next recap
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #737373; font-size: 13px;">
          Memory Recap · <a href="https://memories-recap-one.vercel.app" style="color: #166534;">memories-recap-one.vercel.app</a>
        </p>
      </div>
    `,
  });
}
