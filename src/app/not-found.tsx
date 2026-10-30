import Link from "next/link";
import { EmptyState } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="shell page">
      <EmptyState
        title="หน้านี้อาจย้ายไปแล้ว"
        description="ลองกลับไปค้นหาสินค้าหรือตลาดที่หน้าแรก"
      >
        <Button asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
