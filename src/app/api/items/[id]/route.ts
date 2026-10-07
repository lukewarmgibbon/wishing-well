import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { loadListWithAccess, can } from "@/lib/access";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  url: z.string().trim().url().max(2000).optional(),
  imageUrl: z.string().trim().url().max(2000).nullable().optional(),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  hidden: z.boolean().optional(),
});

async function guard(id: string, userId: string, need: "viewer" | "editor") {
  const item = await prisma.item.findUnique({ where: { id }, select: { id: true, listId: true } });
  if (!item) return { error: "Item not found." as const, status: 404 };
  const found = await loadListWithAccess(item.listId, userId);
  if (!found) return { error: "Item not found." as const, status: 404 };
  if (!can(found.level, need)) {
    return { error: "You don't have permission to change this item." as const, status: 403 };
  }
  return { item };
}

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const g = await guard(id, user.id, "editor");
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = patchSchema.parse(await req.json());
  const item = await prisma.item.update({ where: { id }, data: body });
  return NextResponse.json({ item });
});

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const g = await guard(id, user.id, "editor");
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
