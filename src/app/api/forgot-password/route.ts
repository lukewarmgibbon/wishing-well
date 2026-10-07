import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/rate-limit";
import { sendMail, resetEmail } from "@/lib/mail";
import { issueResetToken } from "@/lib/tokens";
import { handler } from "@/lib/api";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Always returns 200, whether or not the address is known — otherwise this
 * endpoint becomes a way to enumerate which emails have accounts.
 */
export const POST = handler(async (req: Request) => {
  const limit = guard(req, "passwordReset");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const { email } = schema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = await issueResetToken(user.id);
    const mail = resetEmail(user.name, token);
    await sendMail({ ...mail, to: user.email });
  }

  return NextResponse.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
});
