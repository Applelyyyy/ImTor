import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  ArrowUpRight,
  Leaf,
  Clock3,
  Store,
  UtensilsCrossed,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { money } from "@/lib/utils";
import { publicFeatures } from "@/lib/queries";
import type { MarketView, ProductView } from "@/lib/contracts";
export const statusLabel: Record<string, string> = {
  OPEN: "เปิดตามเวลาตลาด",
  SCHEDULED: "รอเปิดตามตาราง",
  CLOSED: "ปิดตลาด",
  FINISHED: "จบแล้ว",
  CANCELLED: "ยกเลิก",
  RESERVED: "รอรับสินค้า",
  COMPLETED: "รับสินค้าแล้ว",
  EXPIRED: "หมดเวลารับ",
  NO_SHOW: "ไม่ได้มารับ",
};
export function time(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function date(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(value));
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title = "ยังไม่มีรายการในตอนนี้",
  description = "ลองเปลี่ยนตัวกรอง หรือกลับมาค้นพบสิ่งใหม่ ๆ อีกครั้ง",
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBag />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
export function ProductCard({
  product: p,
  priority = false,
}: {
  product: ProductView;
  priority?: boolean;
}) {
  return (
    <article className="product-card">
      <Link href={`/product/${p.id}`} className="product-photo">
        <Image
          src={p.imageUrl}
          alt={p.name}
          priority={priority}
          fill
          sizes="(max-width:600px) 47vw,(max-width:1000px) 33vw,25vw"
        />
        <div className="photo-badges">
          {p.price.active && (
            <Badge variant="default">ลด {p.price.discountPercent}%</Badge>
          )}
          {p.mode === "RESCUE" && (
            <Badge variant="secondary">
              <Leaf />
              อิ่มคุ้ม ช่วยลดเหลือ
            </Badge>
          )}
          {p.demo && <Badge variant="outline">ตัวอย่าง</Badge>}
        </div>
        {p.stock === 0 && <span className="sold-out">สินค้าหมด</span>}
      </Link>
      <div className="product-content">
        <Link href={`/store/${p.store.slug}`} className="store-line">
          <Store size={13} />
          {p.store.name}
          {p.store.verified && <span title="ร้านยืนยันแล้ว">✓</span>}
        </Link>
        <Link href={`/product/${p.id}`}>
          <h3>{p.name}</h3>
        </Link>
        <p className="product-location">
          <MapPin size={13} />
          {p.location}
        </p>
        <div className="product-bottom">
          <div className="price">
            {money(p.price.current)}
            {p.price.active && <del>{money(p.price.original)}</del>}
          </div>
          <span className={p.open ? "availability open" : "availability"}>
            {p.open ? "ร้านยืนยันเปิด" : "ยังไม่ยืนยันเปิด"}
          </span>
        </div>
      </div>
    </article>
  );
}
export function ProductGrid({ items }: { items: ProductView[] }) {
  return items.length ? (
    <div className="product-grid">
      {items.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  ) : (
    <EmptyState
      title="ยังไม่เจอสิ่งที่มองหา"
      description="ลองคำค้นอื่นหรือดูสินค้าทั้งหมด ร้านค้าอาจยังไม่ได้เพิ่มสินค้าในวันนี้"
    >
      <Button asChild variant="outline">
        <Link href="/explore">ดูสินค้าทั้งหมด</Link>
      </Button>
    </EmptyState>
  );
}
export function MarketPanel({ markets }: { markets: MarketView[] }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  const sessions = markets.flatMap((m) =>
    m.sessions.filter((s) => s.date === today).map((s) => ({ m, s })),
  );
  return (
    <aside className="market-panel">
      <div className="market-panel-top">
        <span className="market-icon">
          <Store />
        </span>
        <div>
          <p>นัดอร่อยประจำวัน</p>
          <h2>ตลาดวันนี้</h2>
        </div>
        <span className="date-stamp">
          {new Intl.DateTimeFormat("th-TH", {
            timeZone: "Asia/Bangkok",
            day: "numeric",
            month: "short",
          }).format(new Date())}
        </span>
      </div>
      {sessions.length ? (
        sessions.slice(0, 2).map(({ m, s }) => (
          <div className="today-market" key={s.id}>
            <div className="market-name">
              <h3>{m.name}</h3>
              <Badge variant={s.status === "OPEN" ? "default" : "secondary"}>
                {statusLabel[s.status] || s.status}
              </Badge>
            </div>
            <p>
              <Clock3 size={15} />
              {time(s.startsAt)}–{time(s.endsAt)} น.
            </p>
            <div className="vendor-summary">
              <strong>{s.vendorCount}</strong> ร้านลงทะเบียน{" "}
              <span>· {s.confirmedCount} ร้านยืนยันเปิด</span>
            </div>
            <div className="market-actions">
              <Button asChild>
                <Link href={`/markets/${m.slug}`}>
                  ดูร้านค้า <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/markets/${m.slug}/map`}>แผนผังตลาด</Link>
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="today-market">
          <h3>วันนี้ไม่มีตลาดนัดตามตาราง</h3>
          <p>ยังค้นหาร้านประจำและสินค้าอื่น ๆ ได้เสมอ</p>
          <Button asChild variant="outline">
            <Link href="/markets">
              ดูตลาดครั้งถัดไป <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      )}
      <Link className="panel-footer" href="/markets">
        {sessions.length > 2
          ? `ดูอีก ${sessions.length - 2} ตลาด และตารางทั้งสัปดาห์`
          : sessions.some(({ m }) => m.demo)
            ? "มีตลาดตัวอย่าง · ดูตารางทั้งหมด"
            : "วางแผนความอร่อย ดูตารางทั้งสัปดาห์"}{" "}
        <ArrowUpRight size={17} />
      </Link>
    </aside>
  );
}
export function SearchForm({
  q = "",
  action = "/explore",
}: {
  q?: string;
  action?: string;
}) {
  return (
    <form action={action} className="search-form" role="search">
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor="search">
        ค้นหาสินค้าและร้านค้า
      </label>
      <input
        id="search"
        name="q"
        defaultValue={q}
        placeholder="วันนี้อยากกินอะไร? ค้นหาอาหาร ร้านค้า..."
      />
      <Button type="submit">ค้นหา</Button>
    </form>
  );
}
export async function CategoryFilters({
  categories,
  active = "",
  filter = "",
  q = "",
  market = "",
}: {
  categories: { id: string; name: string }[];
  active?: string;
  filter?: string;
  q?: string;
  market?: string;
}) {
  const features = await publicFeatures();
  const href = (c: string, f: string) =>
    "/explore?" +
    new URLSearchParams({
      ...(q && { q }),
      ...(market && { market }),
      ...(c && { category: c }),
      ...(f && { filter: f }),
    }).toString();
  return (
    <nav className="category-filters" aria-label="หมวดหมู่สินค้า">
      <Link
        className={!active && !filter ? "category active" : "category"}
        href={href("", "")}
      >
        <UtensilsCrossed />
        ทั้งหมด
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          className={active === c.id ? "category active" : "category"}
          href={href(c.id, "")}
        >
          {c.name}
        </Link>
      ))}
      <Link
        className={filter === "discount" ? "category active" : "category"}
        href={href("", "discount")}
      >
        ดีลลดราคา
      </Link>
      {features.foodRescueEnabled && (
        <Link
          className={filter === "rescue" ? "category active" : "category"}
          href={href("", "rescue")}
        >
          <Leaf />
          อิ่มคุ้มลดเหลือ
        </Link>
      )}
      <Link
        className={filter === "open" ? "category active" : "category"}
        href={href("", "open")}
      >
        ขายอยู่ตอนนี้
      </Link>
    </nav>
  );
}
