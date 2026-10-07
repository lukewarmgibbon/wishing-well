import { notFound } from "next/navigation";
import { ListDetailView } from "@/components/views/ListDetailView";
import { demoUser, DEMO_ACCOUNTS } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DemoListDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await demoUser(DEMO_ACCOUNTS.alex);
  if (!user) notFound();

  const list = await prisma.wishlist.findUnique({ where: { id }, select: { id: true } });
  if (!list) notFound();

  return <ListDetailView id={id} viewerId={user.id} isDemo />;
}
