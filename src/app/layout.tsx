import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ThemeScript } from "@/components/ThemeScript";
import { auth } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

import { siteUrl } from "@/lib/format";

const SITE = siteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Wishing Well — wishlists worth sharing",
    template: "%s · Wishing Well",
  },
  description:
    "Keep a wishlist, add anything you find online with the browser extension, and share one link so nobody buys the same gift twice.",
  openGraph: {
    type: "website",
    siteName: "Wishing Well",
    title: "Wishing Well — wishlists worth sharing",
    description:
      "Keep a wishlist, add anything you find online, and share one link so nobody buys the same gift twice.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Wishing Well — wishlists worth sharing",
    description: "One link, no duplicates, no guessing.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">
        <TopBar user={session?.user ?? null} />
        <VerifyEmailBanner user={session?.user ?? null} />
        <main className="min-h-[60vh]">{children}</main>
        <footer className="mt-20 border-t border-v-200 dark:border-v-800">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-[0.8125rem] text-v-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-v-600 dark:text-v-300">Wishing Well</span>
            <span>Built for people who are genuinely difficult to buy presents for.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
