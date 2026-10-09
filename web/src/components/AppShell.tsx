"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  BarChart3,
  ClipboardList,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  Layers,
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
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/categories", label: "Categories & Workflows", icon: Layers },
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
      <div className="flex min-h-screen items-center justify-center bg-canvas body-text text-muted">
        Loading session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-amber focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-charcoal px-4 py-2.5 lg:hidden">
        <BrandMark inverted compact />
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="app-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-charcoal/45 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="app-nav"
        className={`${open ? "flex" : "hidden"} lg:flex fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] flex-col bg-charcoal text-white`}
      >
        <div className="hidden border-b border-white/10 px-5 py-5 lg:block">
          <BrandMark inverted />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
          <BrandMark inverted compact />
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-white hover:bg-white/10"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm ${
                  active
                    ? "bg-amber font-medium text-charcoal"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-medium">{user.display_name}</div>
          <div className="meta-text text-white/55">
            {user.username} · {user.role === "ADMIN" ? "Admin" : "Staff"}
          </div>
          <Button variant="ghost" className="mt-3 w-full justify-start text-white hover:bg-white/10" onClick={logout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-72">
        <main id="main" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
