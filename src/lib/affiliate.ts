/**
 * Affiliate link support.
 *
 * Deliberately inert unless `AFFILIATE_ENABLED=true`: with the flag off, every
 * function here is a pass-through, nothing in the UI renders a disclosure, and
 * outbound links are the plain product URLs. Turning it on later should be a
 * config change, not a code change.
 *
 * The design constraint worth stating: the person's link is never rewritten in
 * a way that changes where it points. A "claim" link either resolves to the
 * retailer as-is, or to the same retailer with the network's tracking
 * parameters appended. Anything else — redirect through our domain, link
 * cloaking, anything that obscures the destination — is both a bad experience
 * and, for UK/EU traffic, a compliance problem.
 */

const enabled = () => process.env.AFFILIATE_ENABLED === "true";
const network = () => (process.env.AFFILIATE_NETWORK ?? "").trim();

/** Campaign tags applied to outbound links, so clicks are attributable. */
const DEFAULT_CAMPAIGN = "wishingwell";

/** Hosts we must never tag: wrapping a non-shopping link in tracking params
 *  breaks it (support tickets, unsubscribe links) and leaks the tag publicly. */
const NEVER_TAG = /(^|\.)(google|accounts\.google|facebook|instagram|x\.com|twitter|pinterest|youtube|linkedin|amazon|ebay|paypal|stripe)\./i;

export type AffiliateResult = {
  url: string;
  /** True only when we actually changed the URL. */
  tagged: boolean;
};

/**
 * Appends the network's tracking parameters to a product URL.
 *
 * Returns the input untouched when the feature is off, when no network is
 * configured, when the URL is not a plain https/http link, or when the host is
 * on the never-tag list.
 */
export function affiliateUrl(raw: string, opts: { campaign?: string; source?: string } = {}): AffiliateResult {
  const original = raw;
  if (!enabled() || !network()) return { url: raw, tagged: false };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, tagged: false };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return { url: raw, tagged: false };
  if (NEVER_TAG.test(url.hostname)) return { url: raw, tagged: false };

  // Never clobber a parameter the retailer already set — some of them change
  // the price or the destination when `tag` is present.
  const reserved = /^(tag|affiliate|aff|utm_|irclickid|clickid)/i;
  const has = (name: string) => [...url.searchParams.keys()].some((k) => reserved.test(k));
  if (has("tag")) return { url: raw, tagged: false };

  const campaign = opts.campaign ?? DEFAULT_CAMPAIGN;
  url.searchParams.set("tag", network());
  url.searchParams.set("utm_source", opts.source ?? DEFAULT_CAMPAIGN);
  url.searchParams.set("utm_medium", "affiliate");
  url.searchParams.set("utm_campaign", campaign);

  const next = url.toString();
  if (next === original) return { url: raw, tagged: false };
  return { url: next, tagged: true };
}

/**
 * Tag one item URL.
 *
 * Call this from a **server component only** — typically where the item DTO is
 * built — and hand the result to the client component that renders the link.
 *
 * The affiliate config is a server-side env var and is deliberately not exposed
 * to the browser bundle, so calling `affiliateUrl()` inside a client component
 * tags the link during SSR and then *untags* it on hydration. That is a
 * hydration mismatch, and worse, the href the user finally clicks is the
 * untagged one. Tagging at the DTO layer means the tagged URL is serialised
 * into the RSC payload, so the client renders exactly what the server sent.
 */
export function affiliateItemUrl(url: string): string {
  return affiliateUrl(url).url;
}

/**
 * Whether the affiliate disclosure must be shown.
 *
 * UK/EU advertising rules expect affiliate relationships to be labelled
 * clearly. This is driven by config rather than a build flag so the banner can
 * be turned off in a jurisdiction that doesn't need it.
 */
export function shouldDisclose(): boolean {
  return enabled() && Boolean(network());
}

export function disclosureText(): string | null {
  if (!shouldDisclose()) return null;
  const text = (process.env.AFFILIATE_DISCLOSURE ?? "").trim();
  return text || "Some links are affiliate links — we may earn a commission at no extra cost to you.";
}

/** A human-readable name for the network, for "we may earn from X" copy. */
export function networkName(): string {
  const n = network();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}
