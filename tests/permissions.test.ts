import { describe, it, expect } from "vitest";
import { LIFECYCLE, allows, isOwner, claimForOwner } from "@/lib/permissions";
import type { AccessLevel } from "@/lib/access";

/**
 * The lifecycle rules decide who can archive a list, roll it over, mark a
 * gift received, or re-check a price. A regression here either hands someone
 * else's list to a stranger or quietly de-anonymises a gift claim, so each
 * rule is pinned rather than inferred.
 */

const LEVELS: AccessLevel[] = ["none", "viewer", "editor", "owner"];

describe("allows", () => {
  it("keeps every destructive action owner-only", () => {
    for (const action of ["manageList", "markReceived", "recheckPrice"] as const) {
      expect(LIFECYCLE[action]).toBe("owner");
      for (const level of ["none", "viewer", "editor"] as AccessLevel[]) {
        expect(allows(level, action)).toBe(false);
      }
      expect(allows("owner", action)).toBe(true);
    }
  });

  it("lets an editor add items without letting them archive the list", () => {
    expect(allows("editor", "editItems")).toBe(true);
    expect(allows("editor", "manageList")).toBe(false);
    expect(allows("editor", "markReceived")).toBe(false);
  });

  it("lets any reader claim, but not a follower-less stranger", () => {
    for (const level of LEVELS) {
      expect(allows(level, "claim")).toBe(level !== "none");
    }
  });

  it("denies everything to a level of none", () => {
    for (const action of Object.keys(LIFECYCLE) as (keyof typeof LIFECYCLE)[]) {
      expect(allows("none", action)).toBe(false);
    }
  });

  it("is monotonic — more access never removes a permission", () => {
    for (const action of Object.keys(LIFECYCLE) as (keyof typeof LIFECYCLE)[]) {
      const granted = LEVELS.filter((l) => allows(l, action));
      // LEVELS runs least→most privileged, so a granted action must be a
      // suffix: once allowed, always allowed above.
      expect(granted).toEqual(LEVELS.slice(LEVELS.length - granted.length));
    }
  });
});

describe("isOwner", () => {
  it("is exact, not merely permissive", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("editor")).toBe(false);
    expect(isOwner("viewer")).toBe(false);
    expect(isOwner("none")).toBe(false);
  });
});

describe("claimForOwner", () => {
  it("names the person on a normal claim", () => {
    expect(claimForOwner({ anonymous: false, user: { name: "Sam" } })).toEqual({
      hidden: false,
      label: "Claimed by Sam",
    });
  });

  it("withholds the name on an anonymous claim", () => {
    const claim = claimForOwner({ anonymous: true, user: { name: "Sam" } });
    expect(claim.hidden).toBe(true);
    expect(claim.label).not.toContain("Sam");
  });

  it("copes with a deleted user", () => {
    expect(claimForOwner({ anonymous: false, user: null }).label).toBe("Claimed by a guest");
  });

  it("does not leak a name through an anonymous claim of a null user", () => {
    expect(claimForOwner({ anonymous: true, user: null }).label).toBe("Claimed by a guest");
  });
});
