"use client";

import { Package, ShoppingCart, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth.actions";
import { Role } from "@/enums";
import type { NavLink, SidebarProps } from "@/types";
import { cn } from "@/utils/cn";

const links: NavLink[] = [
  { href: "/items", label: "Items", icon: Package, roles: [Role.SUPER_ADMIN, Role.ADMIN] },
  { href: "/clients", label: "Clients", icon: Users, roles: [Role.SUPER_ADMIN] },
  { href: "/sales", label: "Sales", icon: ShoppingCart, roles: [Role.SUPER_ADMIN] },
  { href: "/users", label: "Users", icon: UserCog, roles: [Role.SUPER_ADMIN] },
];

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col gap-6 bg-primary p-4 text-secondary md:fixed md:inset-y-0 md:left-0 md:w-60 md:overflow-y-auto">
      <div>
        <p className="text-lg font-bold">POS Dashboard</p>
        <p className="text-sm text-neutral-400">
          {profile.full_name} · {profile.role === Role.SUPER_ADMIN ? "Super Admin" : "Admin"}
        </p>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {links
          .filter((link) => link.roles.includes(profile.role))
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold hover:bg-neutral-800",
                pathname.startsWith(href) && "bg-secondary text-primary hover:bg-neutral-200",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
      </nav>

      <form action={logout} className="md:mt-auto">
        <button type="submit" className="w-full cursor-pointer rounded-md border border-secondary px-3 py-2 text-sm font-semibold hover:bg-neutral-800">
          Log out
        </button>
      </form>
    </aside>
  );
}
