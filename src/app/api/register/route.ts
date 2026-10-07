import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { newApiToken, issueVerificationToken } from "@/lib/tokens";
import { sendMail, verifyEmail } from "@/lib/mail";
import { guard } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("That email address doesn't look right."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const POST = handler(async (req: Request) => {
  const limit = guard(req, "register");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many accounts created from here. Try again later." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const body = schema.parse(await req.json());

  const taken = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (taken) {
    // The credentials provider will accept this account too, so nudge them
    // towards sign-in rather than a dead end.
    return NextResponse.json(
      { error: "There's already an account with that email — try signing in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const firstName = body.name.split(" ")[0];

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      apiToken: newApiToken(),
      lists: {
        create: {
          title: `${firstName}'s wishlist`,
          description: "Things I'm saving for. Add more lists whenever you like.",
          slug: `${slugify(body.name)}-${randomBytes(3).toString("hex")}`,
          visibility: "PRIVATE",
        },
      },
    },
  });

  // Password sign-ups must prove they own the address before it can be used
  // for sharing. Google sign-ins are trusted immediately.
  const token = await issueVerificationToken(user.id);
  const mail = verifyEmail(user.name, token);
  const sent = await sendMail({ ...mail, to: user.email });

  return NextResponse.json(
    { id: user.id, verification: sent.delivered ? "sent" : "pending" },
    { status: 201 }
  );
});
