import { prisma } from "@/lib/prisma";

/**
 * Price history and drop detection.
 *
 * Retailers actively block server-side re-fetching, so a background check is
 * best-effort by nature: a failure records nothing and is never allowed to fail
 * the request that triggered it. Everything degrades to "no change".
 */

export type PricePoint = { price: number; currency: string; source: string; createdAt: Date };

export async function recordPrice(
  itemId: string,
  price: number | null | undefined,
  currency = "USD",
  source = "manual"
) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return prisma.itemPrice.create({ data: { itemId, price, currency, source } });
}

/** Percentage below the previous recorded price. Positive means a drop. */
export function dropPercent(history: { price: number }[], current: number): number | null {
  if (history.length === 0) return null;
  const previous = history[0].price; // most recent first
  if (previous <= 0) return null;
  const delta = ((previous - current) / previous) * 100;
  // Ignore noise under 1% — sellers move prices constantly.
  return Math.abs(delta) < 1 ? null : delta;
}

export type PriceSummary = {
  current: number | null;
  previous: number | null;
  lowest: number | null;
  highest: number | null;
  dropPercent: number | null;
  currency: string;
  history: { price: number; createdAt: Date }[];
};

/** Newest first. Returns an empty summary rather than throwing. */
export async function priceSummary(itemId: string, fallbackPrice: number | null): Promise<PriceSummary> {
  const points = await prisma.itemPrice.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { price: true, createdAt: true, currency: true },
  });

  const current = points[0]?.price ?? fallbackPrice;
  return {
    current,
    previous: points[1]?.price ?? null,
    lowest: points.length ? Math.min(...points.map((p) => p.price)) : fallbackPrice,
    highest: points.length ? Math.max(...points.map((p) => p.price)) : fallbackPrice,
    dropPercent: current != null ? dropPercent(points.slice(1), current) : null,
    currency: points[0]?.currency ?? "USD",
    history: points.map((p) => ({ price: p.price, createdAt: p.createdAt })),
  };
}

/**
 * Best-effort re-check of one item's price.
 *
 * NOTE: most retailers will serve a bot-blocked page to a server fetch, so a
 * null return is the common case and is not an error. Real deployments should
 * route this through a hosted scraping API.
 */
export async function fetchPrice(url: string): Promise<{ price: number; currency: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "WishingWell/1.0 (+price-check)",
        accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;

    const html = (await res.text()).slice(0, 400_000);

    // JSON-LD Product, the same shape the extension reads.
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const parsed = JSON.parse(m[1]);
        const found = findProduct(parsed);
        if (found?.price && Number.isFinite(found.price)) {
          return { price: found.price, currency: found.currency ?? "USD" };
        }
      } catch {
        /* malformed JSON-LD is normal */
      }
    }

    // Fallback: Open Graph product price.
    const og = html.match(
      /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9.,]+)["']/i
    );
    if (og) {
      const currency =
        html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([A-Za-z]{3})["']/i)?.[1] ??
        "USD";
      return { price: Number(og[1].replace(/,/g, "")), currency: currency.toUpperCase() };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function findProduct(node: unknown): { price?: number; currency?: string } | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findProduct(n);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  if (o["@graph"]) {
    const r = findProduct(o["@graph"]);
    if (r) return r;
  }
  const type = o["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  if (!isProduct) return null;
  const offers = o.offers;
  const first = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown> | undefined;
  const price = first?.price ?? first?.lowPrice ?? (first?.priceSpecification as Record<string, unknown>)?.price;
  return {
    price: typeof price === "string" ? Number(price) : (price as number | undefined),
    currency: (first?.priceCurrency as string) ?? "USD",
  };
}
