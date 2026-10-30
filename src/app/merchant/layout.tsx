import { requireUser } from "@/components/auth-guard";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
export const metadata = { title: "ร้านของฉัน" };
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="shell workspace merchant-workspace">
    <aside className="sidebar"><h2>ร้านของฉัน</h2><WorkspaceNavigation /></aside>
    <div className="workspace-main">{children}</div>
  </div>;
}
