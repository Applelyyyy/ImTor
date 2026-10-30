import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { MarketManagement } from "@/components/market-management";

export default async function AdminMarkets() {
  await requireAdmin();
  const rows = await db.marketVenue.findMany({
    select: {
      id: true, name: true, type: true, address: true, description: true, entrance: true,
      timezone: true, latitude: true, longitude: true, active: true,
      _count: { select: { stalls: true, zones: true, sessions: true } },
    },
    orderBy: { name: "asc" },
  });
  return <MarketManagement markets={rows} />;
}
