import { notFound } from "next/navigation";
import { ListsView } from "@/components/views/ListsView";
import { demoUser, DEMO_ACCOUNTS } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoLists() {
  const user = await demoUser(DEMO_ACCOUNTS.alex);
  if (!user) notFound();
  return <ListsView userId={user.id} isDemo />;
}
