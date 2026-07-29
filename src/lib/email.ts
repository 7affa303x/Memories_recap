import { BRAND_NAME } from "@/lib/brand";

type RecapReadyEmail = {
  to: string;
  jobId: string;
  resultUrl: string;
};

export async function sendRecapReadyEmail(input: RecapReadyEmail) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || `${BRAND_NAME} <onboarding@resend.dev>`;

  if (!key) {
    console.info(
      JSON.stringify({
        level: "info",
        message: "email_skipped_no_resend_key",
        to: input.to,
        jobId: input.jobId,
      })
    );
    return { ok: false as const, skipped: true as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Your ${BRAND_NAME} is ready`,
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717">
          <h1 style="font-size:22px;margin:0 0 12px">${BRAND_NAME}</h1>
          <p>Your recap finished processing.</p>
          <p><a href="${input.resultUrl}" style="display:inline-block;background:#15803d;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Watch your recap</a></p>
          <p style="color:#737373;font-size:13px">If the button does not work, open:<br/>${input.resultUrl}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      JSON.stringify({
        level: "error",
        message: "email_send_failed",
        status: res.status,
        text: text.slice(0, 300),
      })
    );
    return { ok: false as const, skipped: false as const };
  }

  return { ok: true as const, skipped: false as const };
}
