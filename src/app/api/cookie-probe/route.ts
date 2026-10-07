import { NextResponse } from "next/server";

const NAME = "ww_probe";
const VALUE = "ok";

/**
 * Cookie capability probe.
 *
 * Embedded previews are third-party contexts, and some browsers refuse to store
 * cookies there — which makes cookie-based sign-in impossible and is very hard
 * to diagnose from the outside. The login page calls this twice: the first call
 * sets the cookie, the second reports whether the server actually received it.
 *
 * GET ?set=1  -> sets the cookie
 * GET         -> { seen: boolean }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const existing = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NAME}=`));

  const options = {
    path: "/",
    httpOnly: true,
    sameSite: "none" as const,
    secure: true,
    partitioned: true,
    maxAge: 60,
  };

  if (url.searchParams.get("set") === "1") {
    const res = NextResponse.json({ set: true });
    res.cookies.set(NAME, VALUE, options);
    return res;
  }

  return NextResponse.json(
    { seen: Boolean(existing), value: existing?.split("=")[1] ?? null },
    { headers: { "cache-control": "no-store" } }
  );
}
