import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { issueVerificationToken } from "@/lib/tokens";
import { sendMail, verifyEmail } from "@/lib/mail";
import { handler } from "@/lib/api";

/**
 * Re-sends the confirmation email. Rate limited hard, because this is the one
 * endpoint that sends mail on a live account to an arbitrary address.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const limit = guard(req, "emailVerification");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Check your inbox before asking again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, emailVerified: true },
  });

  if (record.emailVerified) {
    return NextResponse.json({ ok: true, message: "That address is already confirmed." });
  }

  // Replace any outstanding token so only the newest link works.
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
  const token = await issueVerificationToken(user.id);
  const mail = verifyEmail(record.name, token);
  const { delivered } = await sendMail({ ...mail, to: record.email });

  return NextResponse.json({
    ok: true,
    delivered,
    message: delivered
      ? "Confirmation link sent. It expires in 24 hours."
      : "Mail delivery isn't configured, so the link was written to the local outbox instead.",
  });
});
