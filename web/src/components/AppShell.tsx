"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  ClipboardList,
  Folders,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/components/AuthProvider";
import { sessionApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/enquiries", label: "Enquiries & Quotations", icon: ClipboardList },
  { href: "/jobs", label: "Jobs & Job Cards", icon: Printer },
  { href: "/production", label: "Production Board", icon: Kanban },
  { href: "/payments", label: "Payments & Outstanding", icon: Banknote },
  { href: "/reports", label: "Reports & Analytics", icon: Folders },
  { href: "/categories", label: "Categories & Workflows", icon: Folders },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await sessionApi.logout();
    setUser(null);
    router.replace("/login");
  }

  const items = [
    ...NAV,
    ...(user?.role === "ADMIN"
      ? [{ href: "/staff", label: "Staff Management", icon: UserCog }]
      : []),
  ];

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Loading session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="lg:hidden flex items-center justify-between border-b border-line bg-charcoal px-4 py-3">
        <BrandMark inverted />
        <button
          type="button"
          className="text-white"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <aside
        className={`${open ? "flex" : "hidden"} lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-charcoal text-white`}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <BrandMark inverted />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-amber text-charcoal" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Icon size={16} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-medium">{loading ? "…" : user?.display_name}</div>
          <div className="text-xs text-white/60">
            {user ? `${user.username} · ${user.role === "ADMIN" ? "Admin" : "Staff"}` : ""}
          </div>
          <Button variant="ghost" className="mt-3 w-full text-white hover:bg-white/10" onClick={logout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
