import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ListsView } from "@/components/views/ListsView";

export const metadata = { title: "My lists", robots: { index: false, follow: false } };

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/lists");

  return <ListsView userId={session.user.id} apiToken={session.user.apiToken} />;
}
