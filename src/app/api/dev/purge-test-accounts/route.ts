import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ONE-SHOT CLEANUP. Delete this file once it has been run.
 *
 * Removes the throwaway accounts created by signup smoke tests. It cannot
 * reach real user data by construction: the pattern below only matches
 * addresses that were generated for testing, and the route refuses to run
 * unless a caller knows the key committed below.
 *
 * The alternative was leaving a verified test account sitting in the
 * production database, which is worse.
 */

// Only ever matches smoke-test-<digits>@example.com. Real accounts cannot
// match this, and example.com is reserved so it can never be a real inbox.
const TEST_ACCOUNT = /^smoke-test-\d+@example\.com$/;

export async function POST(req: Request) {
  const key = req.headers.get("x-purge-key");
  if (key !== "ww-purge-9f2c4a") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    // `contains` rather than `matches`: regex filters are a Postgres-only
    // operator, and this project runs on SQLite in development.
    where: { email: { contains: "smoke-test" } },
    select: { id: true, email: true },
  });

  const removable = users.filter((u) => TEST_ACCOUNT.test(u.email));

  for (const user of removable) {
    // Cascades to lists, items, sessions and tokens via the schema.
    await prisma.user.delete({ where: { id: user.id } });
  }

  return NextResponse.json({
    deleted: removable.map((u) => u.email),
    skipped: users.filter((u) => !TEST_ACCOUNT.test(u.email)).map((u) => u.email),
  });
}