import { describe, it, expect } from "vitest";
import { accessFor, can } from "@/lib/access";

/**
 * These rules decide who can see a private list. A silent regression here leaks
 * someone's wishlist, so they are pinned down explicitly rather than left to
 * be inferred from a passing HTTP test.
 */

const OWNER = "owner-1";
const VIEWER = "viewer-1";
const EDITOR = "editor-1";

function list(over: Partial<Parameters<typeof accessFor>[0]> = {}) {
  return {
    id: "list-1",
    slug: "my-list",
    ownerId: OWNER,
    visibility: "PRIVATE",
    owner: { id: OWNER, name: "Alex", image: null },
    shares: [],
    links: [],
    ...over,
  } as Parameters<typeof accessFor>[0];
}

const viewerShare = { userId: VIEWER, role: "VIEWER" };
const editorShare = { userId: EDITOR, role: "EDITOR" };

describe("accessFor", () => {
  it("gives the owner everything", () => {
    expect(accessFor(list(), OWNER)).toBe("owner");
  });

  describe("private lists", () => {
    it("denies anonymous visitors", () => {
      expect(accessFor(list(), null)).toBe("none");
    });

    it("denies a signed-in stranger", () => {
      expect(accessFor(list(), "nobody")).toBe("none");
    });

    it("denies even when the owner follows nobody and holds no token", () => {
      expect(accessFor(list(), "nobody", { isFollower: false, token: null })).toBe("none");
    });
  });

  describe("email invites", () => {
    it("grants viewer to an invited viewer", () => {
      expect(accessFor(list({ shares: [viewerShare] }), VIEWER)).toBe("viewer");
    });

    it("grants editor to an invited editor", () => {
      expect(accessFor(list({ shares: [editorShare] }), EDITOR)).toBe("editor");
    });

    it("does not leak to anyone else", () => {
      expect(accessFor(list({ shares: [viewerShare] }), "someone-else")).toBe("none");
    });

    it("an editor is also a viewer", () => {
      expect(can(accessFor(list({ shares: [editorShare] }), EDITOR), "viewer")).toBe(true);
    });
  });

  describe("share links", () => {
    const withLink = list({
      links: [{ token: "good", role: "VIEWER", revoked: false }],
    });

    it("grants access to a valid token, even signed out", () => {
      expect(accessFor(withLink, null, { token: "good" })).toBe("viewer");
    });

    it("denies a revoked token", () => {
      const revoked = list({ links: [{ token: "old", role: "VIEWER", revoked: true }] });
      expect(accessFor(revoked, null, { token: "old" })).toBe("none");
    });

    it("denies an unknown token", () => {
      expect(accessFor(withLink, null, { token: "guessed" })).toBe("none");
    });

    it("never grants more than the link says", () => {
      const editorLink = list({ links: [{ token: "e", role: "EDITOR", revoked: false }] });
      expect(accessFor(editorLink, null, { token: "e" })).toBe("editor");
    });

    it("a token for another list does not open this one", () => {
      expect(accessFor(list({ links: [] }), null, { token: "some-other-lists-token" })).toBe("none");
    });
  });

  describe("following", () => {
    it("grants viewer, never editor", () => {
      const level = accessFor(list(), "follower", { isFollower: true });
      expect(level).toBe("viewer");
      expect(can(level, "editor")).toBe(false);
    });

    it("does not apply to signed-out visitors", () => {
      expect(accessFor(list(), null, { isFollower: true })).toBe("none");
    });
  });

  describe("public lists", () => {
    it("are readable while signed out", () => {
      expect(accessFor(list({ visibility: "PUBLIC" }), null)).toBe("viewer");
    });

    it("are still not editable by a follower", () => {
      const level = accessFor(list({ visibility: "PUBLIC" }), "follower", { isFollower: true });
      expect(can(level, "editor")).toBe(false);
    });

    it("a PUBLIC list cannot be opened with someone else's token either as owner", () => {
      expect(accessFor(list({ visibility: "PUBLIC" }), "stranger")).toBe("viewer");
    });
  });

  describe("precedence", () => {
    it("ownership beats a revoked link", () => {
      const l = list({ links: [{ token: "x", role: "VIEWER", revoked: true }] });
      expect(accessFor(l, OWNER, { token: "x" })).toBe("owner");
    });

    it("an editor invite beats a viewer link", () => {
      const l = list({
        shares: [editorShare],
        links: [{ token: "t", role: "VIEWER", revoked: false }],
      });
      expect(accessFor(l, EDITOR, { token: "t" })).toBe("editor");
    });
  });
});

describe("can", () => {
  const order = ["none", "viewer", "editor", "owner"] as const;
  it("is a total ordering", () => {
    for (const a of order) {
      for (const b of order) {
        expect(can(a, b)).toBe(order.indexOf(a) >= order.indexOf(b));
      }
    }
  });
});
