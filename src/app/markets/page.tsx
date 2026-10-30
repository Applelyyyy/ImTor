import Link from "next/link";
import { markets } from "@/lib/queries";
import {
  PageHeading,
  EmptyState,
  time,
  date,
  statusLabel,
} from "@/components/marketplace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export const metadata = { title: "ตลาดและตารางนัดอร่อย" };
export default async function Markets({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; type?: string }>;
}) {
  const p = await searchParams;
  const venues = await markets();
  const offset = Math.min(4, Math.max(0, Number(p.week) || 0));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
    }).format(d);
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  return (
    <div className="shell page">
      <PageHeading
        title="ตลาดนัดความอร่อย"
        description="เช็กวันเปิดตลาด วางแผนแวะร้านโปรด ไม่ต้องเดา"
      />
      <form className="inline-filter">
        <label htmlFor="type">ประเภทตลาด</label>
        <select id="type" name="type" defaultValue={p.type || ""}>
          <option value="">ทุกประเภท</option>
          {Array.from(new Set(venues.map((v) => v.type))).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button>ดูตาราง</button>
      </form>
      <div className="calendar-nav">
        <h2>ตลาดในสัปดาห์นี้</h2>
        <div className="flex gap-5">
          {offset > 0 && (
            <Link href={`/markets?week=${offset - 1}`}>สัปดาห์ก่อน</Link>
          )}
          <Link href={`/markets?week=${offset + 1}`}>สัปดาห์ถัดไป →</Link>
        </div>
      </div>
      <div className="week-calendar">
        {days.map((d) => (
          <div
            key={d}
            className={d === today ? "calendar-day today" : "calendar-day"}
          >
            <strong>{date(d + "T12:00:00+07:00")}</strong>
            <div>
              {venues
                .filter((m) => !p.type || m.type === p.type)
                .flatMap((m) =>
                  m.sessions
                    .filter((s) => s.date === d)
                    .map((s) => (
                      <Link href={`/markets/${m.slug}`} key={s.id}>
                        {m.name}
                        <small>
                          {time(s.startsAt)}–{time(s.endsAt)} ·{" "}
                          {statusLabel[s.status] || s.status}
                        </small>
                      </Link>
                    )),
                )}
            </div>
          </div>
        ))}
      </div>
      {!venues.length ? (
        <EmptyState
          title="ยังไม่มีตลาดในตาราง"
          description="เมื่อผู้ดูแลเพิ่มตลาดและเวลาเปิด คุณจะเช็กนัดอร่อยได้ที่นี่"
        />
      ) : (
        <div className="two-col">
          {venues
            .filter((m) => !p.type || m.type === p.type)
            .map((m) => (
              <article className="market-card" key={m.id}>
                <Badge variant="secondary">{m.type}</Badge>
                {m.demo && <Badge variant="outline">ข้อมูลตัวอย่าง</Badge>}
                <h2 className="mt-3">{m.name}</h2>
                <p>{m.description}</p>
                <p>{m.address}</p>
                {m.sessions.slice(0, 3).map((s) => (
                  <div className="session-row" key={s.id}>
                    <div>
                      <strong>{date(s.startsAt)}</strong>
                      <small>
                        {time(s.startsAt)}–{time(s.endsAt)} น. · {s.vendorCount}{" "}
                        ร้านลงทะเบียน
                      </small>
                    </div>
                    <Badge
                      variant={s.status === "OPEN" ? "default" : "secondary"}
                    >
                      {statusLabel[s.status] || s.status}
                    </Badge>
                  </div>
                ))}
                <div className="market-actions">
                  <Button asChild>
                    <Link href={`/markets/${m.slug}`}>ดูตลาดและร้านค้า</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/markets/${m.slug}/map`}>แผนผังตลาด</Link>
                  </Button>
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
