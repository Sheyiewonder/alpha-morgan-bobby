
import AdminShell from "../../components/admin/admin-shell";

export const metadata = {
  title: "Admin Dashboard | Bobby",
  description: "Alpha Morgan Bank Bobby administration dashboard.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
