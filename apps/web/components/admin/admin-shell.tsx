
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NextImage from "next/image";
import {
  LayoutDashboard,
  MessageCircle,
  BookOpen,
  AlertTriangle,
  Users,
  Headset,
  Menu,
} from "lucide-react";

const navigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Conversations", href: "/admin/conversations", icon: MessageCircle },
  { label: "Knowledge Base", href: "/admin/knowledge-base", icon: BookOpen },
  { label: "Complaints", href: "/admin/complaints", icon: AlertTriangle },
  { label: "Escalations", href: "/admin/escalations", icon: Users },
  { label: "Human Handoffs", href: "/admin/human-handoffs", icon: Headset },
];

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPage =
    navigation.find((item) => item.href === pathname)?.label ??
    navigation.find(
      (item) =>
        item.href !== "/admin" && pathname.startsWith(item.href)
    )?.label ??
    "Overview";

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#141A1C]">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#141A1C] text-white transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-[84px] items-center gap-3 border-b border-white/10 px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC5424] text-sm font-bold">
            B
          </div>

          <div>
            <p className="text-lg font-bold tracking-tight">Bobby</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
              Alpha Morgan Bank
            </p>
          </div>
        </div>

        <div className="px-5 pt-8">
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#EC5424] font-semibold text-white shadow-lg shadow-orange-950/20"
                      : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          <div className="rounded-xl bg-white/[0.06] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-white/80">
                Bobby is operational
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-white/40">
              AI customer support prototype
            </p>
          </div>

          <p className="mt-5 text-center text-[10px] text-white/30">
            © 2026 Alpha Morgan Bank
          </p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#EAEAEA] bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg border border-[#EAEAEA] p-2 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-[11px] text-[#929292]">
                Bobby / Admin
              </p>
              <h1 className="text-base font-bold sm:text-lg">
                {currentPage}
              </h1>
            </div>
          </div>

          <div className="flex min-w-0 items-center">
            <Link
              href="/admin"
              aria-label="Alpha Morgan Bank home"
              className="group flex shrink-0 items-center"
            >
              <NextImage
                src="/images/AMB logo.PNG"
                alt="Alpha Morgan Bank"
                width={932}
                height={350}
                priority
                className="h-10 w-auto max-w-[180px] object-contain transition duration-300 group-hover:scale-[1.02] sm:h-11 sm:max-w-[220px] lg:h-12 lg:max-w-[240px]"
              />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
