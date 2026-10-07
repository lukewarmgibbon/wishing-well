import { lookup } from "dns/promises";

/**
 * Fetching a URL the user pasted.
 *
 * This is the one place in the app where something outside our control decides
 * what our server connects to, which makes it an SSRF hole unless we close it
 * properly. Someone could paste `http://localhost:5432` or a cloud metadata
 * endpoint and use the site as a proxy into our own database or instance.
 *
 * Every guard here is load-bearing. In particular note that redirect following
 * is manual: a public URL that 302s to `169.254.169.254/` would walk straight
 * past a check that only ever looked at the first URL.
 */

/** Reserved ranges that must never be reachable from a user-supplied URL. */
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = Number(part);
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
    n = (n * 256) + byte;
  }
  return n;
}

export function isPrivateAddress(address: string): boolean {
  // `new URL().hostname` keeps the brackets around an IPv6 literal, so
  // http://[::1]:8080 arrives here as "[::1]" and would miss every check below.
  const bare = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;

  // IPv4-mapped IPv6 (::ffff:10.0.0.1) reaches the same host as the bare IPv4,
  // so unwrap it rather than letting it through as "not an IPv4 address".
  const mapped = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const target = mapped ? mapped[1] : bare;

  const asInt = v4ToInt(target);
  if (asInt !== null) {
    for (const [base, bits] of BLOCKED_V4) {
      const baseInt = v4ToInt(base)!;
      const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
      if ((asInt & mask) >>> 0 === (baseInt & mask) >>> 0) return true;
    }
    return false;
  }

  const lower = bare.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;   // unique local
  if (lower.startsWith("fe80")) return true;                           // link local
  if (lower.startsWith("::ffff:")) return true;                        // unmapped IPv4
  return false;
}

/** Parse and reject anything that isn't an ordinary public web address. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are supported.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || isPrivateAddress(host)) {
    throw new Error("That address isn't allowed.");
  }
  // Names rather than addresses. These all resolve to private addresses, so
  // the DNS check in hostIsPublic() would catch them anyway - but "localhost"
  // is the most obvious thing anyone would paste, and there is never a
  // legitimate reason to let a pasted URL point at the user's own machine.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") || // mDNS names, e.g. printer.local
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("That address isn't allowed.");
  }
  return url;
}

async function hostIsPublic(hostname: string): Promise<boolean> {
  if (isPrivateAddress(hostname)) return false;
  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    // Unresolvable names are the fetch's problem to report, not ours to guess at.
    return true;
  }
  // Every address the name resolves to must be public. One private answer
  // means a DNS rebinding risk, so we refuse rather than pick the good ones.
  return records.every((r) => !isPrivateAddress(r.address));
}

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 7_000;

export interface PublicPage {
  finalUrl: string;
  html: string;
}

/**
 * Fetch a user-supplied URL safely: public addresses only, http/https only,
 * each redirect re-validated, bounded time and response size.
 */
export async function fetchPublicPage(raw: string): Promise<PublicPage> {
  let url = assertPublicHttpUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await hostIsPublic(url.hostname))) {
      throw new Error("That address isn't allowed.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identify ourselves honestly; some retailers serve a blocked stub to
          // unknown agents rather than real HTML.
          "user-agent": "WishingWell/1.0 (+link preview)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      throw new Error("Couldn't reach that site.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("That link doesn't go anywhere.");
      // Re-validate: this is the step that stops a public URL bouncing us onto
      // the loopback interface or a metadata service.
      url = assertPublicHttpUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) throw new Error("That site wouldn't load.");

    // Read at most MAX_BYTES even if the server streams forever.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("That site wouldn't load.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});

    return {
      finalUrl: url.toString(),
      html: new TextDecoder("utf-8", { fatal: false }).decode(
        chunks.length === 1 ? chunks[0] : Buffer.concat(chunks),
      ),
    };
  }

  throw new Error("That link redirected too many times.");
}