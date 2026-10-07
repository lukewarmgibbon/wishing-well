/**
 * Content script: works out what the current page is selling so the popup can
 * show "Add this to…" without the user typing anything.
 *
 * Everything is best-effort — if a site is unusual we fall back to the tab URL
 * and the page title, which is still addable.
 */

const META_SELECTORS = {
  title: [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[itemprop="name"]',
  ],
  image: [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[itemprop="image"]',
    'link[rel="image_src"]',
  ],
  price: [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[name="twitter:data1"]',
    'meta[itemprop="price"]',
  ],
  currency: [
    'meta[property="product:price:currency"]',
    'meta[property="og:price:currency"]',
    'meta[itemprop="priceCurrency"]',
    'meta[name="twitter:label1"]',
  ],
};

function firstMeta(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const value = el?.getAttribute("content") || el?.getAttribute("href");
    if (value) return value.trim();
  }
  return null;
}

/** Read JSON-LD Product blocks — most commerce sites publish these. */
function fromJsonLd() {
  const out = {};
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);

    const type = node["@type"];
    const isProduct =
      type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (!isProduct) {
      if (node["@graph"]) walk(node["@graph"]);
      return;
    }

    out.title ??= typeof node.name === "string" ? node.name : null;
    out.image ??= Array.isArray(node.image) ? node.image[0] : node.image ?? null;
    out.description ??= typeof node.description === "string" ? node.description : null;

    const offers = node.offers;
    const first = Array.isArray(offers) ? offers[0] : offers;
    if (first) {
      const price = first.price ?? first.lowPrice ?? first.priceSpecification?.price;
      if (typeof price === "number" || (typeof price === "string" && price.trim())) {
        out.price ??= Number(price);
      }
      out.currency ??= first.priceCurrency ?? first.priceSpecification?.priceCurrency ?? null;
    }

    const brand = node.brand;
    out.brand ??= typeof brand === "string" ? brand : brand?.name ?? null;
  };

  scripts.forEach((s) => {
    try {
      walk(JSON.parse(s.textContent));
    } catch {
      /* malformed JSON-LD is common and harmless */
    }
  });

  return out;
}

function detectCurrencyText() {
  // Fallback: a price on the page like "£129.99".
  const text = document.body?.innerText?.slice(0, 20000) ?? "";
  const m = text.match(/([£$€]|USD|GBP|EUR)\s?([0-9][0-9,]{0,6}(?:\.[0-9]{2})?)/);
  if (!m) return {};
  const symbols = { "£": ["GBP", 1], $: ["USD", 1], "€": ["EUR", 1], USD: ["USD", 1], GBP: ["GBP", 1], EUR: ["EUR", 1] };
  const [currency, multiplier] = symbols[m[1]];
  return { price: Number(m[2].replace(/,/g, "")) * multiplier, currency };
}

function cleanUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(u, location.href);
    return url.protocol.startsWith("http") ? url.toString() : null;
  } catch {
    return null;
  }
}

function collect() {
  const ld = fromJsonLd();
  const fallbackPrice = detectCurrencyText();

  const title =
    firstMeta(META_SELECTORS.title) || ld.title || ld.brand || document.title || location.hostname;

  const image = cleanUrl(firstMeta(META_SELECTORS.image) || ld.image);

  let price = firstMeta(META_SELECTORS.price);
  const currency = firstMeta(META_SELECTORS.currency) || ld.currency || fallbackPrice.currency || "USD";

  if (price == null && ld.price != null) price = String(ld.price);
  if (price == null && fallbackPrice.price != null) price = String(fallbackPrice.price);

  const parsed = Number.parseFloat(String(price ?? "").replace(/[^0-9.]/g, ""));

  return {
    title: String(title).trim().slice(0, 300),
    url: location.href.split("#")[0],
    imageUrl: image,
    price: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null,
    currency: /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD",
    site: location.hostname.replace(/^www\./, ""),
    description: ld.description ?? null,
  };
}

// The popup asks for this; keep it cheap so the page is never disturbed.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "collect") {
    try {
      sendResponse({ ok: true, data: collect() });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true; // keep the channel open for the async response
});

/* ------------------------------------------------------------------ *
 * Bulk capture: find every product linked on this page.
 *
 * Two passes, because no single technique is reliable on the open web:
 *   1. JSON-LD Product blocks — exact, when the site publishes them.
 *   2. Product-ish links in the DOM, scored by how much evidence surrounds
 *      them (an image, a nearby price, a money-ish URL path).
 *
 * Precision matters more than recall here: the popup pre-selects everything
 * it returns, so one nav link mistaken for a product is a wrong item on
 * someone's list. Anything that fails the evidence bar is dropped.
 * ------------------------------------------------------------------ */

/** Pull every Product in the page's JSON-LD, with its URL if it declares one. */
function productsFromJsonLd() {
  const found = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  const takeProduct = (node) => {
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const raw = offers?.price ?? offers?.lowPrice ?? node.priceSpecification?.price;
    const price = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
    found.push({
      title: typeof node.name === "string" ? node.name : null,
      url: cleanUrl(node.url),
      imageUrl: cleanUrl(Array.isArray(node.image) ? node.image[0] : node.image),
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency: offers?.priceCurrency ?? "USD",
    });
  };

  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);

    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];

    if (types.includes("Product")) return takeProduct(node);

    // ItemList wraps products in ListItem entries, which nest under `.item`.
    if (types.includes("ListItem") || node.item) return visit(node.item);

    if (node.itemListElement) visit(node.itemListElement);
    if (node["@graph"]) visit(node["@graph"]);
  };

  scripts.forEach((s) => {
    try {
      visit(JSON.parse(s.textContent));
    } catch {
      /* malformed JSON-LD is common and harmless */
    }
  });

  return found;
}

const PRICE_RE = /(?:£|\$|€|USD|GBP|EUR)\s?([0-9][0-9,]*(?:\.[0-9]{2})?)/;
const CURRENCY_BY_SYMBOL = { "\u00a3": "GBP", $: "USD", "\u20ac": "EUR" };
const MONEY_PATH_HINT = /\/(?:p|product|products|dp|item|shop|buy)\//i;
const SOCIAL_RE = /\.(?:facebook|instagram|twitter|x\.com|pinterest|tiktok|linkedin|youtube)\./i;

/** Is this anchor plausibly a link to a thing you could buy? */
function looksLikeProduct(anchor) {
  const href = anchor.getAttribute("href") ?? "";
  // Relative product links are the norm on stores, so resolve before judging.
  if (!cleanUrl(href)) return false;
  if (SOCIAL_RE.test(href)) return false;

  const img = anchor.querySelector("img");
  const text = (anchor.getAttribute("title") || anchor.textContent || "").trim();
  if (!img && text.length < 8) return false;

  // A link whose entire label is a price is a filter or a size chart.
  return !(PRICE_RE.test(text) && !img);
}

/**
 * Text near this link that might contain its price.
 *
 * Stores lay product cards out in wildly different ways, so this tries, in
 * order: the enclosing product-ish container, the immediate parent, then the
 * few siblings either side (a common "image+title here, price there" layout).
 * It deliberately never reaches <body>, where one page-wide price would make
 * every nav link look like a product.
 */
function nearbyText(anchor, radius = 2) {
  const container = anchor.closest(
    "[data-product], [itemtype*='Product'], [class*='product'], li, article"
  );
  if (container) return (container.textContent ?? "").slice(0, 400);

  const parent = anchor.parentElement;
  if (parent && parent !== document.body) return (parent.textContent ?? "").slice(0, 400);

  const parts = [];
  let node = anchor;
  for (let i = 0; i < radius && node; i++) {
    node = node.nextElementSibling;
    if (node) parts.push(node.textContent ?? "");
  }
  node = anchor;
  for (let i = 0; i < radius && node; i++) {
    node = node.previousElementSibling;
    if (node) parts.push(node.textContent ?? "");
  }
  return parts.join(" ").slice(0, 400);
}

/** Turn a scored anchor into a product-shaped object, or null. */
function fromAnchor(anchor) {
  const url = cleanUrl(anchor.getAttribute("href"));
  if (!url) return null;

  const parsed = new URL(url);
  const sameSite = parsed.hostname.replace(/^www\./, "") === location.hostname.replace(/^www\./, "");

  const img = anchor.querySelector("img");
  const imageUrl = cleanUrl(img?.currentSrc || img?.getAttribute("src") || img?.getAttribute("data-src"));

  const m = nearbyText(anchor).match(PRICE_RE);
  const value = m ? Number.parseFloat(m[1].replace(/,/g, "")) : NaN;
  const price = Number.isFinite(value) && value > 0 ? value : null;

  const currency =
    parsed.searchParams.get("utm_currency")?.toUpperCase() ||
    (m ? CURRENCY_BY_SYMBOL[m[0].trim()[0]] ?? "USD" : "USD");

  const onProductPath = MONEY_PATH_HINT.test(parsed.pathname);

  // Evidence scoring. The bar is deliberately high — a false positive is a
  // wrong item on someone's list, a false negative is one they can add by hand.
  const score =
    1 + (imageUrl ? 3 : 0) + (price != null ? 4 : 0) + (onProductPath ? 3 : 0) + (sameSite ? 1 : 0);

  // Hard gate: a product link carries a picture or lives under a product path.
  // Price alone is not enough — a stray price in a neighbouring element would
  // otherwise promote a nav link to a product.
  if (!imageUrl && !onProductPath) return null;
  if (score < 5) return null;

  const title = (
    anchor.getAttribute("title") ||
    img?.getAttribute("alt") ||
    (anchor.textContent ?? "").replace(/\s+/g, " ").trim() ||
    document.title
  ).slice(0, 300);
  if (title.length < 3) return null;

  return { title, url, imageUrl, price, currency, score };
}

function collectProducts(limit = 40) {
  const byUrl = new Map();

  // JSON-LD beats a DOM guess, because it is authored rather than inferred.
  const merge = (entry, score, source) => {
    if (!entry?.url || !entry.title) return;
    const key = entry.url.split("#")[0];
    const existing = byUrl.get(key);
    if (!existing || score > existing.score) byUrl.set(key, { ...existing, ...entry, score, source });
  };

  productsFromJsonLd().forEach((p) => merge(p, 100, "json-ld"));

  const anchors = document.querySelectorAll("a[href]");
  for (let i = 0; i < anchors.length && byUrl.size < limit * 3; i++) {
    const anchor = anchors[i];
    if (!looksLikeProduct(anchor)) continue;
    const entry = fromAnchor(anchor);
    if (entry) merge(entry, entry.score, "page");
  }

  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, source, ...rest }) => rest);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "scan") {
    try {
      sendResponse({ ok: true, products: collectProducts(msg.limit ?? 40) });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true;
});
