/**
 * Email delivery.
 *
 * There is deliberately no hard dependency on a provider. In development the
 * message is written to disk and logged, so the whole verification and reset
 * flow is genuinely testable without an account anywhere. Set RESEND_API_KEY in
 * production and the same messages go out for real.
 */

import { mkdir, appendFile } from "fs/promises";
import path from "path";
import { siteUrl } from "@/lib/format";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function appUrl() {
  return siteUrl(process.env.NEXT_PUBLIC_APP_URL);
}

async function writeToOutbox(mail: Mail) {
  const dir = path.join(process.cwd(), ".outbox");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${mail.to.replace(/[^\w.@-]/g, "_")}.txt`);
  await appendFile(
    file,
    `To: ${mail.to}\nSubject: ${mail.subject}\nDate: ${new Date().toISOString()}\n\n${mail.text}\n`
  );
  return file;
}

/** Never throws — a failed email must not roll back a successful request. */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean; detail: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const file = await writeToOutbox(mail).catch(() => null);
    console.log(`[mail:dev] → ${mail.to} · ${mail.subject}${file ? ` (written to ${file})` : ""}`);
    return { delivered: false, detail: file ? `written to ${file}` : "logged only" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "Wishing Well <noreply@resend.dev>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return { delivered: true, detail: "sent via Resend" };
  } catch (err) {
    console.error("[mail] send failed:", err);
    return { delivered: false, detail: "send failed" };
  }
}

export function verifyEmail(userName: string | null, token: string) {
  const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to: "",
    subject: "Confirm your email address",
    text: `Hi ${userName ?? "there"},\n\nConfirm your email address so you can share lists and receive gifts securely:\n\n${url}\n\nThe link works once and expires in 24 hours.`,
  };
}

export function resetEmail(userName: string | null, token: string) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to: "",
    subject: "Reset your password",
    text: `Hi ${userName ?? "there"},\n\nReset your password here:\n\n${url}\n\nThe link works once and expires in 30 minutes. If you didn't ask for this, you can ignore this email — nothing has changed.`,
  };
}
