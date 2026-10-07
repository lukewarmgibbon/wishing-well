import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeVerificationToken } from "@/lib/tokens";
import { handler } from "@/lib/api";

const schema = z.object({ token: z.string().min(10) });

/** Consumes a single-use verification token. Google sign-ins skip this. */
export const POST = handler(async (req: Request) => {
  const { token } = schema.parse(await req.json());
  const record = await consumeVerificationToken(token);
  if (!record) {
    return NextResponse.json({ error: "That confirmation link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ ok: true });
});
