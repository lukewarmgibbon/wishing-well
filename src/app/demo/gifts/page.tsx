import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GiftsView } from "@/components/views/GiftsView";
import { demoUser, DEMO_ACCOUNTS } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoGifts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; person?: string; sort?: string; max?: string; occasion?: string }>;
}) {
  const sam = await demoUser(DEMO_ACCOUNTS.sam);
  if (!sam) notFound();

  // Occasions need someone to follow; without any, fall back to Alex so the
  // demo has something to show.
  const following = await prisma.follow.count({ where: { followerId: sam.id } });
  const me = following > 0 ? sam.id : ((await demoUser(DEMO_ACCOUNTS.alex))?.id ?? sam.id);

  return <GiftsView me={me} isDemo searchParams={await searchParams} />;
}
