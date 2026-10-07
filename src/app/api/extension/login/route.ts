import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api";
import { guard } from "@/lib/rate-limit";
import { newApiToken } from "@/lib/tokens";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Extension sign-in. Exchanges email + password for a long-lived API token
 * that the extension stores in chrome.storage. Google-only accounts pair the
 * extension from the signed-in web app instead.
 */
export const POST = handler(async (req: Request) => {
  const limit = guard(req, "login");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const body = schema.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Always compare, even when the user is missing, so both paths cost the same.
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const ok = await bcrypt.compare(body.password, hash);

  if (!user || !user.passwordHash || !ok) {
    return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
  }

  // One stable token per user — revoking it later logs the extension out everywhere.
  return NextResponse.json({
    token: user.apiToken,
    user: { id: user.id, name: user.name, email: user.email },
  });
});
