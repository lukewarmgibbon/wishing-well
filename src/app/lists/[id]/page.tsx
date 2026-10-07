import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ListDetailView } from "@/components/views/ListDetailView";

export const metadata = { title: "Wishlist · Wishing Well" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=/lists/${id}`);

  return <ListDetailView id={id} viewerId={session.user.id} />;
}
