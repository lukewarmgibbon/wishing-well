import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { loadListWithAccess } from "@/lib/access";

const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["VIEWER", "EDITOR"]).optional(),
});

/** Invite an existing user to a list by email. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can share this." }, { status: 403 });

  const body = shareSchema.parse(await req.json());
  const target = await prisma.user.findUnique({ where: { email: body.email } });
  if (!target) {
    return NextResponse.json(
      { error: "No account with that email yet. They can still use a share link." },
      { status: 404 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "You already own this list." }, { status: 400 });
  }

  const share = await prisma.share.upsert({
    where: { listId_userId: { listId: id, userId: target.id } },
    update: { role: body.role ?? "VIEWER" },
    create: { listId: id, userId: target.id, role: body.role ?? "VIEWER" },
  });

  return NextResponse.json({ share });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can share this." }, { status: 403 });

  const url = new URL(req.url);
  const shareId = url.searchParams.get("shareId");
  if (shareId) {
    await prisma.share.deleteMany({ where: { id: shareId, listId: id } });
  } else {
    await prisma.share.deleteMany({ where: { listId: id } });
  }
  return NextResponse.json({ ok: true });
});

/** Mint a revocable link that works even for signed-out visitors. */
export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can share this." }, { status: 403 });

  const body = z
    .object({ action: z.enum(["revoke", "toggle"]), token: z.string().optional(), revoked: z.boolean().optional() })
    .parse(await req.json());

  if (body.action === "revoke" && body.token) {
    await prisma.shareLink.updateMany({ where: { token: body.token, listId: id }, data: { revoked: true } });
  } else if (body.action === "toggle" && body.token && body.revoked !== undefined) {
    await prisma.shareLink.updateMany({ where: { token: body.token, listId: id }, data: { revoked: body.revoked } });
  }

  return NextResponse.json({ ok: true });
});

/** POST with ?intent=link creates a new link. */
export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can share this." }, { status: 403 });

  const role = z.enum(["VIEWER", "EDITOR"]).catch("VIEWER").parse(
    (await req.json().catch(() => ({}))).role
  );

  const link = await prisma.shareLink.create({
    data: { listId: id, token: randomBytes(16).toString("base64url"), role },
  });

  // Making a list reachable via link implies it is no longer private.
  if (found.list.visibility === "PRIVATE") {
    await prisma.wishlist.update({ where: { id }, data: { visibility: "SHARED" } });
  }

  return NextResponse.json({ link }, { status: 201 });
});
