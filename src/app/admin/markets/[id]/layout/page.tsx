import { requireAdmin } from "@/components/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { LayoutEditor } from "@/components/layout-editor";
import { Button } from "@/components/ui/button";
export default async function LayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const market = await db.marketVenue.findUnique({
    where: { id },
    include: {
      zones: { orderBy: { name: "asc" } },
      stalls: { orderBy: { code: "asc" } },
    },
  });
  if (!market) notFound();
  return (
    <div className="stack">
      <PageHeading
        title={`ผังตลาด · ${market.name}`}
        description="วางล็อกบนผังด้วยการลากหรือปุ่มลูกศร แล้วบันทึกเมื่อพร้อม"
      >
        <Button asChild variant="outline">
          <Link href={`/admin/markets/${id}/schedule`}>ข้อมูลและวันเปิด</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/markets">กลับรายการตลาด</Link>
        </Button>
      </PageHeading>
      <LayoutEditor
        key={id}
        marketId={id}
        image={market.layoutImage}
        zones={market.zones}
        stalls={market.stalls}
      />
    </div>
  );
}
