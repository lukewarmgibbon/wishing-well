import { describe, it, expect } from "vitest";
import { scrapeProduct } from "@/lib/scrape";

const PAGE = `<!doctype html><html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="Le Creuset &amp; Co Round Casserole">
  <meta property="og:image" content="/media/hero.jpg">
  <meta property="product:price:amount" content="£249.95">
  <meta property="product:price:currency" content="GBP">
</head><body></body></html>`;

describe("scrapeProduct", () => {
  it("reads Open Graph product data", () => {
    const p = scrapeProduct(PAGE, "https://shop.example.com/cookware/casserole");
    expect(p.title).toBe("Le Creuset & Co Round Casserole");
    expect(p.price).toBe(249.95);
    expect(p.currency).toBe("GBP");
    expect(p.retailer).toBe("shop.example.com");
  });

  it("decodes entities in the title", () => {
    const p = scrapeProduct(PAGE, "https://example.com/a");
    expect(p.title).not.toContain("&amp;");
  });

  it("resolves a relative og:image against the page URL", () => {
    const p = scrapeProduct(PAGE, "https://shop.example.com/cookware/casserole");
    expect(p.image).toBe("https://shop.example.com/media/hero.jpg");
  });

  it("falls back to <title> when Open Graph is absent", () => {
    const p = scrapeProduct(
      "<html><head><title>Plain Shop Item</title></head></html>",
      "https://example.com/a",
    );
    expect(p.title).toBe("Plain Shop Item");
    expect(p.price).toBeNull();
  });

  it("reads price from JSON-LD when the OG tags are missing", () => {
    const p = scrapeProduct(
      `<script type="application/ld+json">{"@type":"Product","price":"89.99"}</script>`,
      "https://example.com/a",
    );
    expect(p.price).toBe(89.99);
  });

  it("parses European number formatting", () => {
    const withAmount = (amount: string) =>
      scrapeProduct(`<meta property="product:price:amount" content="${amount}">`, "https://example.com/a");
    expect(withAmount("1.234,50").price).toBe(1234.5);
    expect(withAmount("1,234.50").price).toBe(1234.5);
    expect(withAmount("249,95").price).toBe(249.95);
    expect(withAmount("249.95").price).toBe(249.95);
    expect(withAmount("249").price).toBe(249);
  });

  it("rejects a rating or review count mistaken for a price", () => {
    const p = scrapeProduct(
      `<meta property="product:price:amount" content="0"><meta property="og:title" content="Great product 4.5 stars">`,
      "https://example.com/a",
    );
    expect(p.price).toBeNull();
  });

  it("ignores a non-currency code", () => {
    const p = scrapeProduct(
      `<meta property="product:price:currency" content="dollars">`,
      "https://example.com/a",
    );
    expect(p.currency).toBeNull();
  });

  it("returns nulls rather than throwing on an empty page", () => {
    const p = scrapeProduct("", "https://example.com/a");
    expect(p.title).toBeNull();
    expect(p.price).toBeNull();
    expect(p.image).toBeNull();
  });

  it("strips www from the retailer name", () => {
    const p = scrapeProduct(PAGE, "https://www.example.com/a");
    expect(p.retailer).toBe("example.com");
  });
});