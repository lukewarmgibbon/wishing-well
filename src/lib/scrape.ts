/**
 * Pull product details out of an HTML page.
 *
 * Retailers advertise their data in Open Graph and schema.org microdata
 * precisely so other sites can do this, so reading those tags is the intended
 * path rather than scraping the visible layout. The Chrome extension already
 * reads the same tags client-side (`extension/content.js`); this is the server
 * equivalent, used when someone shares a link or pastes one on a phone.
 */

export interface ProductPreview {
  url: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  retailer: string | null;
}

function meta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    // Covers both attribute orders, which real pages use inconsistently.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
      "i",
    );
    const tag = html.match(re)?.[0];
    if (!tag) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content && content.trim()) return decodeEntities(content.trim());
  }
  return null;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function toAbsolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "£1,234.50" and "1.234,50" both have to become 1234.5. */
function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal point.
    if (lastComma > lastDot) return num(cleaned.replace(/\./g, "").replace(",", "."));
    return num(cleaned.replace(/,/g, ""));
  }
  if (lastComma > -1) {
    // A lone comma is a decimal separator only if it isn't grouping digits.
    return /,\d{1,2}$/.test(cleaned) ? num(cleaned.replace(",", ".")) : num(cleaned.replace(/,/g, ""));
  }
  return num(cleaned);
}

function num(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

export function scrapeProduct(html: string, finalUrl: string): ProductPreview {
  const retailer = new URL(finalUrl).hostname.replace(/^www\./, "");

  const rawTitle =
    meta(html, "og:title", "twitter:title") ??
    html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)?.[1]?.trim() ??
    null;
  const title = rawTitle ? decodeEntities(rawTitle).replace(/\s+/g, " ").trim().slice(0, 200) : null;

  const rawImage = meta(html, "og:image:secure_url", "og:image", "twitter:image");
  const image = rawImage ? toAbsolute(rawImage, finalUrl) : null;

  const currency = meta(html, "product:price:currency", "og:price:currency", "twitter:data1");

  let price =
    parsePrice(meta(html, "product:price:amount", "og:price:amount")) ??
    // JSON-LD block, which most larger retailers publish.
    parsePrice(
      html.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1] ?? null,
    );

  // An "amount" that clearly isn't money means we matched a rating or a count.
  if (price !== null && price < 0.5 && /\d/.test(rawTitle ?? "")) price = null;

  return {
    url: finalUrl,
    title,
    image,
    price,
    currency: currency && /^[A-Z]{3}$/i.test(currency.trim()) ? currency.trim().toUpperCase() : null,
    retailer,
  };
}