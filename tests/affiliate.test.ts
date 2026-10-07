import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { affiliateUrl, shouldDisclose } from "@/lib/affiliate";

/**
 * Affiliate tagging is the one place in the app where we touch a URL the user
 * will actually click, so the "do nothing unless configured" and "never break a
 * link" guarantees are pinned here rather than trusted to a config value.
 */

const ORIGINAL = { ...process.env };

function enable(extra: Record<string, string> = {}) {
  process.env.AFFILIATE_ENABLED = "true";
  process.env.AFFILIATE_NETWORK = "wishlistco";
  Object.assign(process.env, extra);
}

beforeEach(() => {
  process.env = { ...ORIGINAL };
  delete process.env.AFFILIATE_ENABLED;
  delete process.env.AFFILIATE_NETWORK;
  delete process.env.AFFILIATE_DISCLOSURE;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("when disabled", () => {
  it("returns the URL untouched and untagged", () => {
    process.env.AFFILIATE_NETWORK = "wishlistco";
    const url = "https://shop.example.com/product/thing";
    expect(affiliateUrl(url)).toEqual({ url, tagged: false });
  });

  it("does not require disclosure", () => {
    expect(shouldDisclose()).toBe(false);
  });

  it("is inert even if a network is set but the flag is not", () => {
    process.env.AFFILIATE_NETWORK = "wishlistco";
    expect(affiliateUrl("https://shop.example.com/p/1", {}).tagged).toBe(false);
  });
});

describe("when enabled", () => {
  beforeEach(() => enable());

  it("appends tracking parameters", () => {
    const { url, tagged } = affiliateUrl("https://shop.example.com/product/thing");
    expect(tagged).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("tag")).toBe("wishlistco");
    expect(parsed.searchParams.get("utm_medium")).toBe("affiliate");
  });

  it("preserves the path and existing query parameters", () => {
    const { url } = affiliateUrl("https://shop.example.com/product/thing?variant=blue");
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/product/thing");
    expect(parsed.searchParams.get("variant")).toBe("blue");
  });

  it("does not double-tag a URL that already has a tag", () => {
    const once = affiliateUrl("https://shop.example.com/p/1").url;
    const twice = affiliateUrl(once);
    expect(twice.tagged).toBe(false);
    expect(twice.url).toBe(once);
  });

  it("leaves a retailer-set affiliate id alone", () => {
    const url = "https://shop.example.com/p/1?irclickid=abc";
    expect(affiliateUrl(url)).toEqual({ url, tagged: false });
  });

  it("accepts a campaign override", () => {
    const { url } = affiliateUrl("https://shop.example.com/p/1", { campaign: "christmas" });
    expect(new URL(url).searchParams.get("utm_campaign")).toBe("christmas");
  });

  it("leaves non-shopping hosts alone", () => {
    for (const host of [
      "https://www.google.com/search?q=x",
      "https://facebook.com/somepage",
      "https://stripe.com/pay/1",
    ]) {
      expect(affiliateUrl(host)).toEqual({ url: host, tagged: false });
    }
  });

  it("passes through anything that is not a URL", () => {
    for (const junk of ["", "not a url", "javascript:alert(1)", "mailto:a@b.com"]) {
      expect(affiliateUrl(junk)).toEqual({ url: junk, tagged: false });
    }
  });

  it("requires disclosure", () => {
    expect(shouldDisclose()).toBe(true);
  });

  it("does not require disclosure when enabled with no network", () => {
    process.env.AFFILIATE_NETWORK = "";
    expect(shouldDisclose()).toBe(false);
  });
});

/**
 * The affiliate config is a server-side env var and is deliberately not shipped
 * to the browser. If a client component ever calls into this module, React tags
 * the link during SSR and then untags it on hydration — the mismatch is visible
 * in the console, but the real damage is that the href the user clicks is the
 * untagged one, so commission is silently lost.
 *
 * These guards fail loudly instead.
 */
describe("client components must not compute affiliate URLs", () => {
  const CLIENT_COMPONENTS = [
    "src/components/list/ItemCard.tsx",
    "src/components/AffiliateDisclosure.tsx",
  ];

  it.each(CLIENT_COMPONENTS)("%s does not import affiliate URL logic", (file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/\b(affiliateUrl|affiliateItemUrl)\b/);
  });

  it("tags items in server components, where the env var exists", () => {
    for (const file of [
      "src/app/w/[slug]/page.tsx",
      "src/components/views/GiftsView.tsx",
      "src/components/views/ListDetailView.tsx",
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source).toMatch(/affiliateItemUrl\(/);
    }
  });
});
