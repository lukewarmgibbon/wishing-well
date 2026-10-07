import type { NextConfig } from "next";

/**
 * `ALLOW_FRAMING` exists only for the sandboxed live preview, which renders the
 * app inside a cross-site iframe. Everywhere else it must stay off: allowing
 * any site to frame the app is a clickjacking hole, because a hostile page can
 * overlay invisible UI on top of a signed-in session and trick people into
 * clicking things they can't see.
 */
const allowFraming = process.env.ALLOW_FRAMING === "true";

// `headers()` is evaluated when the app is *built* and baked into the output,
// so for `next start` this variable is build-time only. Setting it on the
// running server does nothing at all — which is the dangerous direction, since
// it looks like it worked. Say so loudly at build time.
if (allowFraming) {
  console.warn(
    "\n  [wishing-well] ALLOW_FRAMING=true — this build will refuse clickjacking " +
      "protection and any site may frame it.\n" +
      "  This is intended for the sandboxed live preview only. Rebuild without it " +
      "before deploying.\n",
  );
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // The live preview is served from a proxy host rather than localhost. Without
  // this, Next blocks its own dev resources (HMR, fonts) for that origin.
  //
  // This reads an env var a human types into a dashboard, and people reasonably
  // paste a bare hostname without the scheme. `new URL("example.com")` throws,
  // and because config is evaluated during the build, that turns a typo into a
  // failed deploy with an error that says nothing about the cause. Assume the
  // scheme, fall back to localhost, and complain loudly rather than crash.
  allowedDevOrigins: (() => {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return ["*.e2b.app", "localhost"];
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      return ["*.e2b.app", new URL(withScheme).hostname];
    } catch {
      console.warn(
        `  [wishing-well] NEXT_PUBLIC_APP_URL ("${raw}") is not a usable URL; ` +
          "falling back to localhost for dev origins.",
      );
      return ["*.e2b.app", "localhost"];
    }
  })(),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: allowFraming
          ? [
              { key: "X-Frame-Options", value: "ALLOWALL" },
              { key: "Content-Security-Policy", value: "frame-ancestors *" },
            ]
          : [
              // Refuse framing outright, and name ourselves in the policy so a
              // future copy-pasted `frame-ancestors` can't quietly undo this.
              { key: "X-Frame-Options", value: "DENY" },
              { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
            ],
      },
      {
        // Baseline hardening for a site that handles sign-in.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
