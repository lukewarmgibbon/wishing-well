import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { auth, googleEnabled } from "@/lib/auth";

export const metadata = { title: "Create an account · Wishing Well" };

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/lists");
  return (
    <div className="px-5 py-20">
      <Suspense>
        <AuthForm mode="register" googleEnabled={googleEnabled} />
      </Suspense>
    </div>
  );
}
