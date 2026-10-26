import { redirect } from "next/navigation";
import { getProfile, isDashboardUser } from "@/lib/auth";
import LoginForm from "@/sections/LoginForm";

export default async function LoginPage() {
  if (isDashboardUser(await getProfile())) redirect("/items");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
