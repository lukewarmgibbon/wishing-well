import type { AccessLevel } from "@/lib/access";

/**
 * Who may do what, for the lifecycle actions.
 *
 * These were inline `if (level !== "owner")` checks scattered across five
 * route handlers, which is exactly the shape of code where one endpoint
 * quietly ends up more permissive than the rest. They live here instead, so
 * the whole policy is one readable table and one test file.
 */
export const LIFECYCLE = {
  /** Archive, restore, roll over: destructive or history-changing, owner only. */
  manageList: "owner",
  /** Mark a gift received: only the person whose list it is. */
  markReceived: "owner",
  /** Re-check a price: the owner asked for the alert, so the owner opts in. */
  recheckPrice: "owner",
  /** Add/edit items on someone else's list needs an EDITOR invite. */
  editItems: "editor",
  /** Claiming a gift only needs to see the list. */
  claim: "viewer",
} as const satisfies Record<string, AccessLevel>;

export type LifecycleAction = keyof typeof LIFECYCLE;

const RANK: Record<AccessLevel, number> = { none: 0, viewer: 1, editor: 2, owner: 3 };

export function allows(level: AccessLevel, action: LifecycleAction): boolean {
  return RANK[level] >= RANK[LIFECYCLE[action]];
}

/** Convenience for the common "is this mine?" check in a route handler. */
export function isOwner(level: AccessLevel): boolean {
  return level === "owner";
}

/**
 * Whether a claim should be shown to the list owner.
 *
 * Anonymous claims are the point of the feature, so the owner's view must
 * actually honour the flag — a single missed `where` clause here silently
 * de-anonymises everyone who used it.
 */
export function claimsVisibleToOwner(reservations: { anonymous: boolean }[]): boolean {
  return reservations.length > 0;
}

export type AnonymisedClaim = { anonymous: boolean; user: { name: string | null } | null };

/** What the owner is allowed to see about one claim. */
export function claimForOwner(claim: AnonymisedClaim): { hidden: boolean; label: string } {
  if (claim.anonymous) return { hidden: true, label: "Claimed by a guest" };
  return { hidden: false, label: `Claimed by ${claim.user?.name ?? "a guest"}` };
}
