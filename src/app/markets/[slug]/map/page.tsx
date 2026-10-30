import { notFound } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { market } from "@/lib/queries";
import { PageHeading, EmptyState } from "@/components/marketplace";
import { StallMap } from "@/components/stall-map";
import { FormSubmit } from "@/components/pending-controls";
export const metadata = { title: "แผนผังตลาดและตำแหน่งร้าน" };
export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stall?: string; session?: string }>;
}) {
  const { slug } = await params;
  const p = await searchParams;
  const m = await market(slug, p.session);
  if (!m) notFound();
  return (
    <div className="shell page">
      <div className="breadcrumbs">
        <Link href={`/markets/${slug}`}>{m.name}</Link> / แผนผังตลาด
      </div>
      <PageHeading
        title={`หาร้านใน${m.name}`}
      />
      <Form action="" className="inline-filter">
        <label htmlFor="map-session">ตำแหน่งร้านในรอบตลาด</label>
        <select
          id="map-session"
          name="session"
          defaultValue={
            p.session ||
            m.sessions.find(
              (s) =>
                s.endsAt > new Date().toISOString() && s.status !== "CANCELLED",
            )?.id
          }
        >
          {m.sessions.map((s) => (
            <option value={s.id} key={s.id}>
              {s.date} · {s.status === "CANCELLED" ? "ยกเลิก" : "ตามตาราง"}
            </option>
          ))}
        </select>
        <FormSubmit label="ดูตำแหน่ง" pendingLabel="กำลังโหลด…" />
      </Form>
      {m.stalls.length ? (
        <StallMap
          market={m}
          selected={p.stall}
          sessionKey={p.session || "default"}
        />
      ) : (
        <EmptyState
          title="ยังไม่ได้เพิ่มแผนผังตลาด"
          description="ผู้ดูแลตลาดสามารถเพิ่มโซน ล็อก และตำแหน่งร้านได้"
        />
      )}
    </div>
  );
}
