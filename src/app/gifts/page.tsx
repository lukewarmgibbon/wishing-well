import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GiftsView } from "@/components/views/GiftsView";

export const metadata = { title: "Gifting", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function GiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; person?: string; sort?: string; max?: string; occasion?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/gifts");
  return <GiftsView me={session.user.id} searchParams={await searchParams} />;
}
