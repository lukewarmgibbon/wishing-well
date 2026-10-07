import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { newApiToken } from "@/lib/tokens";

/**
 * Issue a fresh API token. The old one stops working immediately, which signs
 * the extension out everywhere — the recovery path if the code ever leaks.
 */
export const POST = handler(async () => {
  const user = await requireUser();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { apiToken: newApiToken() },
    select: { apiToken: true },
  });
  return NextResponse.json({ apiToken: updated.apiToken });
});
