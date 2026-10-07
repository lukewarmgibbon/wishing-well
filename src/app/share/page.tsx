import Link from "next/link";
import { ShareCapture } from "./ShareCapture";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Add to a list",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the Android share target.
 *
 * Chrome does not reliably put a shared link in the `url` parameter - often it
 * arrives inside `text` instead, sometimes alongside the page title. So the
 * extraction has to look in both places, and tolerate finding nothing at all
 * rather than showing an error the user can't act on.
 */
function pickSharedUrl(url: string | null, text: string | null, title: string | null): string | null {
  const candidates = [url, text, title].filter(Boolean) as string[];
  const fromExplicit = candidates.find((c) => /^https?:\/\//i.test(c.trim()));
  if (fromExplicit) return fromExplicit.trim();
  // Fall back to the first bare link embedded in the shared text.
  for (const candidate of candidates) {
    const found = candidate.match(/https?:\/\/[^\s<>"')]+/i);
    if (found) return found[0];
  }
  return null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SharePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) ?? null;
  const shared = pickSharedUrl(one("url"), one("text"), one("title"));

  const session = await auth();

  if (!session?.user?.id) {
    // Don't bounce to sign-in and lose the link - that's the whole point of the
    // share flow. Pass it along so the form is still filled in afterwards.
    const next = `/share${shared ? `?url=${encodeURIComponent(shared)}` : ""}`;
    return (
      <div className="px-5 py-16">
        <div className="mx-auto max-w-md border border-hair px-8 py-10 text-center dark:border-hair-d">
          <h1 className="text-xl font-semibold">Sign in to save that</h1>
          <p className="mt-2 text-sm text-v-600 dark:text-v-300">
            We&apos;ll bring this link straight back after you sign in.
          </p>
          <Link className="btn btn-primary mt-5" href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in
          </Link>
          <p className="mt-4 text-sm">
            <Link href="/register" className="underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const lists = await prisma.wishlist.findMany({
    where: { ownerId: session.user.id, archivedAt: null },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="px-5 py-16">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Add to a list</h1>
        <p className="mt-1 text-sm text-v-600 dark:text-v-300">
          Check the details before saving.
        </p>
        <div className="mt-6">
          <ShareCapture sharedUrl={shared} lists={lists} />
        </div>
      </div>
    </div>
  );
}