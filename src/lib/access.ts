import { prisma } from "@/lib/prisma";

export type AccessLevel = "owner" | "editor" | "viewer" | "none";

type ListWithAccess = {
  id: string;
  slug: string;
  ownerId: string;
  visibility: string;
  owner: { name: string | null; image: string | null; id: string };
  shares: { userId: string; role: string }[];
  links: { token: string; role: string; revoked: boolean }[];
};

const RANK: Record<AccessLevel, number> = { none: 0, viewer: 1, editor: 2, owner: 3 };

/**
 * Work out what a given viewer may do with a list.
 *
 * - owner  : full control
 * - editor : added to the list by someone with editor rights (share or follow)
 * - viewer : can see the list and reserve items
 * - none   : no access
 *
 * A revoked/expired link token degrades to `none`, so a leaked link can be killed.
 */
export function accessFor(
  list: ListWithAccess,
  viewerId: string | null,
  opts: { token?: string | null; isFollower?: boolean } = {}
): AccessLevel {
  if (viewerId && list.ownerId === viewerId) return "owner";

  const share = viewerId ? list.shares.find((s) => s.userId === viewerId) : undefined;
  if (share) return share.role === "EDITOR" ? "editor" : "viewer";

  if (opts.token) {
    const link = list.links.find((l) => l.token === opts.token);
    if (link && !link.revoked) return link.role === "EDITOR" ? "editor" : "viewer";
  }

  if (viewerId && opts.isFollower) return "viewer";

  // A list the owner explicitly published is readable by anyone, signed in or not.
  if (list.visibility === "PUBLIC") return "viewer";

  return "none";
}

export function can(level: AccessLevel, need: AccessLevel) {
  return RANK[level] >= RANK[need];
}

/** Throws a 404-style error if the viewer cannot see the list. */
export function assertAccess(level: AccessLevel, need: AccessLevel, message?: string) {
  if (!can(level, need)) {
    const err = new Error(message ?? "You do not have access to this list.") as Error & { status: number };
    err.status = need === "none" ? 404 : 403;
    throw err;
  }
}

/**
 * Load a list together with everything needed to compute access.
 * `token` lets a share link work for signed-out visitors.
 */
export async function loadListWithAccess(slugOrId: string, viewerId: string | null, token?: string | null) {
  const list = await prisma.wishlist.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      shares: { select: { userId: true, role: true } },
      links: { select: { token: true, role: true, revoked: true } },
    },
  });
  if (!list) return null;

  let isFollower = false;
  if (viewerId) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: viewerId, followeeId: list.ownerId } },
    });
    isFollower = Boolean(follow);
  }

  return { list, level: accessFor(list, viewerId, { token, isFollower }) };
}
