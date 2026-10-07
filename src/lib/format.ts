export type ItemDTO = {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  note: string | null;
  priority: number;
  hidden: boolean;
  receivedAt?: string | Date | null;
  position: number;
  reservations: { id: string; userId?: string; name?: string | null; image?: string | null; note?: string | null; createdAt?: string; anonymous?: boolean }[];
};

export function money(value: number | null | undefined, currency = "USD") {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export const PRIORITY = {
  1: { label: "Nice to have", cls: "bg-v-50 dark:bg-v-900 text-v-500 dark:text-v-400" },
  2: { label: "Would love", cls: "bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15" },
  3: { label: "Really want", cls: "bg-a-100 dark:bg-a-900/40 text-a-600 dark:text-a-300" },
} as const;

export const VISIBILITY = {
  PRIVATE: { label: "Private", hint: "Only you can see this list.", cls: "bg-v-50 dark:bg-v-900 text-v-500 dark:text-v-400" },
  SHARED: { label: "Shared link", hint: "Anyone with the link can view and claim items.", cls: "bg-a-600-wash text-a-600 dark:text-a-300 dark:bg-a-600-wash-d" },
  PUBLIC: { label: "Public", hint: "Listed on your profile — visible to everyone.", cls: "bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15" },
} as const;

export type Visibility = keyof typeof VISIBILITY;

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

/** Pull a plausible product title out of a URL for a nicer default. */
export function titleFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
    return decodeURIComponent(last)
      .replace(/[-_]+/g, " ")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  } catch {
    return "New item";
  }
}

/**
 * Normalise a site URL that a human typed into a dashboard.
 *
 * People paste `example.com`, `example.com/`, or the full `https://example.com`,
 * and all three mean the same thing to us. `new URL()` only accepts the last
 * one and throws on the other two — and because this runs during the build, a
 * missing scheme turns into a failed deploy with an error that points nowhere
 * near the real cause.
 *
 * So: assume https when no scheme is given, strip trailing slashes, and return
 * the local default rather than throwing if the result is still unusable.
 */
export function siteUrl(raw: string | undefined | null, fallback = "http://localhost:3000"): string {
  const value = raw?.trim();
  if (!value) return fallback;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
}
