import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/rate-limit";
import { consumeResetToken } from "@/lib/tokens";
import { handler } from "@/lib/api";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const POST = handler(async (req: Request) => {
  const limit = guard(req, "passwordReset");
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = schema.parse(await req.json());
  const record = await consumeResetToken(body.token);
  if (!record) {
    // Invalid, already used, or expired — all the same answer.
    return NextResponse.json({ error: "That reset link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await bcrypt.hash(body.password, 12) },
  });

  // Any session issued before the reset is no longer trustworthy.
  await prisma.resetToken.deleteMany({ where: { userId: record.userId } });

  return NextResponse.json({ ok: true });
});
