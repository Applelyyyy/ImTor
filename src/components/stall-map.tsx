"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import type { MarketView, StallView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, money } from "@/lib/utils";
import { searchStalls } from "@/lib/stall-search";
import styles from "./stall-map.module.css";

const mobileQuery = "(max-width: 767px)";
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

export function StallMap({ sessionKey = "default", ...props }: {
  market: MarketView; selected?: string; sessionKey?: string;
}) {
  return <StallMapView key={`${props.market.id}:${sessionKey}:${props.selected ?? ""}`} {...props} />;
}
function StallDetails({ stall, market }: { stall: StallView; market: MarketView }) {
  const vendor = stall.vendor;
  return <div className={cn("stall-details", styles.details)}>
    {vendor ? <>
      <div className={styles.summary}><p><strong>{vendor.name}</strong></p>
      <p>{vendor.status === "OPEN" ? "ร้านยืนยันเปิด" : "ลงทะเบียนตามตาราง ยังไม่ยืนยันเปิด"} · {vendor.verified ? "ยืนยันตำแหน่งแล้ว" : "ตำแหน่งที่ร้านแจ้งเอง"}</p>
      {vendor.demo && <p className="help-text">ร้านสาธิตและตำแหน่งสมมติ ไม่ใช่สถานที่จริง</p>}
      </div>
      <div className={styles.products}>
        {vendor.products.map((product) => <Link key={product.id} href={`/product/${product.id}`} className={styles.product}>
          <Image src={product.imageUrl} alt="" width={80} height={64} />
          <span><span className={styles.productName}>{product.name}</span><span className={styles.price}>{money(product.price.current)}{product.price.active && <del>{money(product.price.original)}</del>}</span></span>
        </Link>)}
      </div>
    </> : <p>ยังไม่มีร้านลงทะเบียนในอิ่มต่อ ไม่ได้ยืนยันว่าพื้นที่จริงว่าง</p>}
    {stall.directions && <p className={styles.directions}>{stall.directions}</p>}
    <div className={styles.links}>
      {vendor && <Button asChild size="sm"><Link href={`/store/${vendor.slug}`}>ดูร้านและสินค้า</Link></Button>}
      {market.latitude !== null && market.longitude !== null ? <Button asChild variant="outline" size="sm"><a href={`https://www.google.com/maps/dir/?api=1&destination=${market.latitude},${market.longitude}`} target="_blank" rel="noopener noreferrer">นำทางไปตลาด</a></Button> : <Button asChild variant="outline" size="sm"><Link href={`/markets/${market.slug}`}>ดูที่ตั้งตลาด</Link></Button>}
    </div>
  </div>;
}
function panToMarker(container: HTMLDivElement | null, marker?: HTMLButtonElement) {
  if (!marker || !container) return;
  const markerRect = marker.getBoundingClientRect(), containerRect = container.getBoundingClientRect();
  container.scrollTo({ left: container.scrollLeft + markerRect.left - containerRect.left - container.clientWidth / 2 + markerRect.width / 2,
    top: container.scrollTop + markerRect.top - containerRect.top - container.clientHeight / 2 + markerRect.height / 2, behavior: "instant" });
}
function StallMapView({ market: m, selected }: { market: MarketView; selected?: string }) {
  const [id, setId] = useState(selected || "");
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!!selected);
  const panelId = useId();
  const searchId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const lastTrigger = useRef<HTMLElement | null>(null);
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
  const stalls = m.stalls.filter((stall) => stall.active);
  const active = stalls.find((stall) => stall.code === id);
  const results = searchStalls(stalls, query);

  // Only scroll the map's own viewport: never scroll the page to the marker.
  useEffect(() => { panToMarker(viewport.current, markers.current.get(id)); }, [id, zoom]);

  // Fit the adjacent panel to its actual viewport position, not a guessed header height.
  // Re-measure after results/fonts/layout changes as well as viewport and sticky scroll changes.
  useEffect(() => {
    const element = panel.current;
    if (mobile || !element) return;
    let frame = 0, disposed = false;
    const fit = () => {
      frame = 0;
      if (!disposed) {
        const navigation = document.querySelector("body > .mobile-nav")?.getBoundingClientRect();
        const bottom = navigation?.height ? Math.min(window.innerHeight, navigation.top) : window.innerHeight;
        element.style.setProperty("--panel-available", `${Math.max(0, bottom - element.getBoundingClientRect().top - 16)}px`);
      }
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    document.fonts.ready.then(schedule);
    fit();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [mobile, id, open, query]);

  function select(code: string, trigger: HTMLElement) {
    if (!mobile || !open) lastTrigger.current = trigger;
    setId(code);
    setOpen(true);
    if (!mobile || !open) markers.current.get(code)?.focus({ preventScroll: true });
    panToMarker(viewport.current, markers.current.get(code));
  }
  function close() {
    setOpen(false);
    (lastTrigger.current ?? markers.current.get(id))?.focus({ preventScroll: true });
  }
  return <div className={styles.root}>
    <form className={styles.search} role="search" aria-label="ค้นหาในแผนผังตลาด" onSubmit={(event) => {
      event.preventDefault();
      if (results[0]) select(results[0].code, event.currentTarget.querySelector("input")!);
    }}>
      <label className={styles.searchField} htmlFor={searchId}>ค้นหาร้าน สินค้า โซน หรือรหัสล็อก
        <Input id={searchId} type="search" placeholder="เช่น ข้าวผัด หรือ A01" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <Button type="submit">ค้นหา</Button>
    </form>
    <p className="help-text" role="status">{query.trim() ? `พบ ${results.length} ล็อก` : `ทั้งหมด ${results.length} ล็อก · เลือกร้านเพื่อดูตำแหน่ง`}</p>
    <div className={styles.results} role="region" aria-label="ผลการค้นหาร้านและล็อก">
      {results.map((stall) => <button type="button" className="stall-list-item" key={stall.id} onClick={(event) => select(stall.code, event.currentTarget)} aria-pressed={id === stall.code} aria-controls={panelId}>
        <strong>โซน {stall.zone} · {stall.code}</strong><span>{stall.vendor?.name || "ยังไม่มีร้านลงทะเบียน"}</span>

      </button>)}
      {!results.length && <p className="help-text">ไม่พบร้านหรือสินค้า ลองชื่อร้าน โซน หรือรหัสล็อกอื่น</p>}
    </div>
    <div className={styles.workspace} data-map-workspace="">
      <div className={styles.mapColumn}>
        <div className={styles.toolbar}>
          <Button type="button" variant="outline" size="sm" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + .25))}>ขยาย +</Button>
          <Button type="button" variant="outline" size="sm" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - .25))}>ย่อ −</Button>
          <span className="help-text">สีเขียว = มีร้านลงทะเบียน</span>
        </div>
        <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="ผังล็อกที่เลื่อนได้">
          <div className="map-stage" style={{ "--map-zoom": zoom } as CSSProperties}>
            <div className="map-canvas">
              {m.layoutImage && <Image src={m.layoutImage} alt={`ผังตลาด ${m.name}`} fill sizes="(min-width: 768px) 65vw, 100vw" />}
              <div className="map-grid" />
              {stalls.map((stall) => <button key={stall.id} type="button" ref={(node) => { if (node) markers.current.set(stall.code, node); else markers.current.delete(stall.code); }}
                className={cn("stall-marker", stall.vendor && "occupied", id === stall.code && "selected")}
                style={{ left: `${stall.x * 100}%`, top: `${stall.y * 100}%` }}
                aria-label={`ล็อก ${stall.code} โซน ${stall.zone}${stall.vendor ? ` ${stall.vendor.name}` : " ยังไม่มีร้านลงทะเบียน"}`}
                aria-pressed={id === stall.code} aria-controls={panelId} onClick={(event) => select(stall.code, event.currentTarget)}>{stall.code}</button>)}
            </div>
          </div>
        </div>
      </div>
      {!mobile && <section ref={panel} id={panelId} className={styles.panel} aria-live="polite" aria-labelledby={`${panelId}-title`} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); } }}>
        {active && open ? <>
          <div className={styles.panelHeader}><h2 id={`${panelId}-title`}>โซน {active.zone} · ล็อก {active.code}</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="ปิดรายละเอียดล็อก" onClick={close}><X /></Button></div>
          <StallDetails key={active.id} stall={active} market={m} />
        </> : <><h2 id={`${panelId}-title`}>รายละเอียดร้านและล็อก</h2><p className="help-text mt-3">เลือกร้านจากแผนผังหรือผลการค้นหาเพื่อดูสินค้าและราคา</p></>}
      </section>}
    </div>
    {mobile && <Sheet open={open && !!active} onOpenChange={(value) => { if (!value) close(); }}>
      <SheetContent id={panelId} side="bottom" className={styles.sheet} onCloseAutoFocus={(event) => { event.preventDefault(); (lastTrigger.current ?? markers.current.get(id))?.focus({ preventScroll: true }); }}>
        <SheetHeader className="p-0 pr-8"><SheetTitle>โซน {active?.zone} · ล็อก {active?.code}</SheetTitle><SheetDescription>รายละเอียดร้านและสินค้าในรอบตลาดที่เลือก</SheetDescription></SheetHeader>
        {active && <>
          <div className={styles.toolbar} aria-label="เปลี่ยนล็อกที่เลือก">
            <Button type="button" variant="outline" size="sm" disabled={stalls.indexOf(active) <= 0} onClick={(event) => select(stalls[stalls.indexOf(active) - 1].code, event.currentTarget)}>ล็อกก่อนหน้า</Button>
            <Button type="button" variant="outline" size="sm" disabled={stalls.indexOf(active) >= stalls.length - 1} onClick={(event) => select(stalls[stalls.indexOf(active) + 1].code, event.currentTarget)}>ล็อกถัดไป</Button>
          </div>
          <StallDetails key={active.id} stall={active} market={m} />
        </>}
      </SheetContent>
    </Sheet>}
    <p className="map-note mt-3">เลื่อนผังซ้าย–ขวาเพื่อดูล็อกทั้งหมด · ผังภายในตลาด ไม่ใช่เส้นทางเดินที่ตรวจสอบแล้ว ตำแหน่งที่ร้านแจ้งเองจะแสดงแยกจากตำแหน่งยืนยัน</p>
  </div>;
}
