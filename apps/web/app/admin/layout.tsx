import { Suspense } from "react";
import AdminShell from "@/components/admin/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#141A1C] text-white">
          Loading admin dashboard...
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}