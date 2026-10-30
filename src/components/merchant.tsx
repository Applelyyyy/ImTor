import Link from "next/link";
import { requireUser } from "@/components/auth-guard";
import { dashboardStore } from "@/lib/queries";
import { EmptyState } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
export async function merchantStore() {
  const user = await requireUser();
  return dashboardStore(user.id);
}
export function NoStore() {
  return (
    <EmptyState
      title="เปิดร้านของฉัน"
      description="เพิ่มชื่อร้าน แล้วเริ่มลงสินค้าได้เลย"
    >
      <Button asChild>
        <Link href="/become-vendor">เปิดร้านของฉัน</Link>
      </Button>
    </EmptyState>
  );
}
