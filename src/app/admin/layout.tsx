import { requireAdmin } from "@/components/auth-guard";
import { AdminNavigation } from "@/components/admin-navigation";
export const metadata = { title: "จัดการระบบ" };
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="shell workspace admin-workspace">
      <AdminNavigation />
      <div className="workspace-main">{children}</div>
    </div>
  );
}
