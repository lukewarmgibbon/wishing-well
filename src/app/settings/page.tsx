import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileSettings } from "@/components/ProfileSettings";

export const metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, emailVerified: true, anonClaims: true },
  });

  const [listCount, claims, following] = await Promise.all([
    prisma.wishlist.count({ where: { ownerId: session.user.id, archivedAt: null } }),
    prisma.reservation.count({ where: { userId: session.user.id } }),
    prisma.follow.count({ where: { followerId: session.user.id } }),
  ]);

  return (
    <ProfileSettings
      name={user.name}
      email={user.email}
      image={user.image}
      emailVerified={Boolean(user.emailVerified)}
      anonClaims={user.anonClaims}
      listCount={listCount}
      claims={claims}
      following={following}
    />
  );
}
