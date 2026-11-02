import { Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import Sidebar from "@/sections/Sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);

  return (
    <div className="flex flex-1 flex-col">
      <Sidebar profile={profile} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6 md:ml-60">{children}</main>
    </div>
  );
}
