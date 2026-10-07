import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Single-use tokens are stored hashed. A database leak therefore does not hand
 * an attacker working reset or verification links.
 */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** Personal access token used by the browser extension. */
export function newApiToken() {
  return randomBytes(24).toString("hex");
}

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m

export async function issueVerificationToken(userId: string) {
  const token = newToken();
  await prisma.verificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  return token;
}

export async function issueResetToken(userId: string) {
  const token = newToken();
  await prisma.resetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  return token;
}

type TokenRecord = { id: string; userId: string; expiresAt: Date };
type TokenModel = {
  findUnique: (args: { where: { tokenHash: string } }) => Promise<TokenRecord | null>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

/** Consumes a token: valid → deletes it and returns the user, else null. */
async function consume(model: TokenModel, token: string) {
  if (!token) return null;
  const record = await model.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) {
    await model.delete({ where: { id: record.id } });
    return null;
  }
  return record;
}

export const consumeVerificationToken = (t: string) =>
  consume(prisma.verificationToken as unknown as TokenModel, t);

export const consumeResetToken = (t: string) => consume(prisma.resetToken as unknown as TokenModel, t);
