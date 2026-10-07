import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";

/**
 * Web app manifest.
 *
 * This is what lets Wishing Well be added to an Android home screen and then
 * appear in the system share sheet, so someone can share a product page
 * straight into their list without the site ever being opened first.
 *
 * Chrome deliberately requires installation before a site may register as a
 * share target, so nothing here can opt a visitor in - they have to choose
 * "Add to home screen" themselves.
 *
 * `share_target.action` is an absolute URL. Relative actions work in most
 * builds but have been reported to resolve incorrectly on Android, which
 * manifests as the icon simply never appearing in the share menu.
 */
export default function manifest(): MetadataRoute.Manifest {
  const origin = siteUrl(process.env.NEXT_PUBLIC_SITE_URL);

  return {
    name: "Wishing Well",
    short_name: "Wishing Well",
    description: "Wishlists worth sharing.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f9fb",
    theme_color: "#5f6df5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: `${origin}/share`,
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}