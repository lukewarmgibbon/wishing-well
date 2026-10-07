import { prisma } from "@/lib/prisma";

/**
 * Identities used by the read-only demo routes.
 *
 * The preview runs in a frame that blocks cookies, which makes session-based
 * sign-in impossible there. These routes render the same components against the
 * seeded data so the app can be explored without authenticating.
 */
export const DEMO_ACCOUNTS = {
  alex: "alex@example.com",
  sam: "sam@example.com",
  priya: "priya@example.com",
} as const;

export async function demoUser(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
}
