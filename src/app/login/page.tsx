import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { auth, googleEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in · Wishing Well" };

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/lists");
  return (
    <div className="px-5 py-20">
      <Suspense>
        <AuthForm mode="login" googleEnabled={googleEnabled} />
      </Suspense>
    </div>
  );
}
