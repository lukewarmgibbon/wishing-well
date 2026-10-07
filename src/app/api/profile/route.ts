import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { handler } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  anonClaims: z.boolean().optional(),
  // Present only when the user is changing their password.
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

/** Profile and claim-privacy preferences. */
export const PATCH = handler(async (req: Request) => {
  const me = await requireUser();

  const limit = guard(req, "apiWrite");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const body = schema.parse(await req.json().catch(() => ({})));

  const data: { name?: string; anonClaims?: boolean; passwordHash?: string } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.anonClaims !== undefined) data.anonClaims = body.anonClaims;

  if (body.newPassword) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    // Google-only accounts have no password to confirm against, so the first
    // password set is allowed to skip it.
    if (user.passwordHash) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
      }
      const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "That password is not right." }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: me.id },
    data,
    select: { name: true, email: true, anonClaims: true },
  });

  return NextResponse.json({ user });
});
