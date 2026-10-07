import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/rate-limit";
import { fetchPublicPage } from "@/lib/public-fetch";
import { scrapeProduct } from "@/lib/scrape";
import { handler } from "@/lib/api";

const schema = z.object({ url: z.string().min(1).max(2000) });

/**
 * Turn a pasted or shared product URL into item fields.
 *
 * Used by the phone flow (share target, paste-a-link) where there is no page to
 * read from, and by the manual add form to pre-fill.
 *
 * Failures return a usable answer rather than an error where they can: a shop
 * that blocks us should still let the user save the link and type the rest.
 */
export const POST = handler(async (req: Request) => {
  const limit = guard(req, "metadata");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many lookups. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const { url } = schema.parse(await req.json());

  try {
    const page = await fetchPublicPage(url);
    return NextResponse.json({ ok: true, product: scrapeProduct(page.html, page.finalUrl) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that link.";
    // The link is still valid and saveable, so hand back just the URL and let
    // the client carry on rather than blocking the user.
    return NextResponse.json({ ok: false, error: message, product: { url } }, { status: 200 });
  }
});