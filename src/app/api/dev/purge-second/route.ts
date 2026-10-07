import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** ONE-SHOT CLEANUP. Delete this file immediately after running it. */

export async function POST() {
  // Hardcoded to the single address just created. Narrower than a pattern:
  // there is no way for this to touch an address that isn't this exact one.
  const target = "noreply-check-1791399902@example.com";

  const user = await prisma.user.findUnique({ where: { email: target }, select: { id: true } });

  if (!user) return NextResponse.json({ deleted: [], note: "already absent" });

  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ deleted: [target] });
}