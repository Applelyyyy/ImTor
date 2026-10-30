"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MarketView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
export function StallMap({
  market: m,
  selected,
}: {
  market: MarketView;
  selected?: string;
}) {
  const [id, setId] = useState(selected || ""),
    [zoom, setZoom] = useState(1),
    [query, setQuery] = useState("");
  const stalls = m.stalls.filter((s) => s.active);
  const active = stalls.find((s) => s.code === id);
  return (
    <>
      <div className="map-controls">
        <label className="sr-only" htmlFor="stall-search">
          ค้นหาร้านหรือล็อก
        </label>
        <input
          className="rounded-lg border bg-white p-2 text-sm"
          id="stall-search"
          placeholder="ค้นหาร้าน หรือรหัสล็อก"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
        >
          ขยาย +
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          ย่อ −
        </Button>
        <span className="help-text">สีเขียว = มีร้านลงทะเบียน</span>
      </div>
      <div className="overflow-auto rounded-2xl">
        <div className="map-canvas" style={{ width: `${zoom * 100}%` }}>
          {m.layoutImage && (
            <Image
              src={m.layoutImage}
              alt={`ผังตลาด ${m.name}`}
              fill
              sizes="100vw"
            />
          )}
          <div className="map-grid" />
          {stalls.map((s) => (
            <button
              key={s.id}
              className={`stall-marker${s.vendor ? " occupied" : ""}${id === s.code ? " selected" : ""}`}
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
              aria-label={`ล็อก ${s.code} โซน ${s.zone}${s.vendor ? ` ${s.vendor.name}` : " ยังไม่มีร้านลงทะเบียน"}`}
              aria-pressed={id === s.code}
              onClick={() => setId(s.code)}
            >
              {s.code}
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div className="location-panel" aria-live="polite">
          <h2>
            โซน {active.zone} · ล็อก {active.code}
          </h2>
          {active.vendor ? (
            <>
              <p>
                {active.vendor.name} ·{" "}
                {active.vendor.status === "OPEN"
                  ? "ร้านยืนยันเปิด"
                  : "ลงทะเบียนตามตาราง ยังไม่ยืนยันเปิด"}{" "}
                ·{" "}
                {active.vendor.verified
                  ? "ยืนยันตำแหน่งแล้ว"
                  : "ตำแหน่งที่ร้านแจ้งเอง"}
              </p>
              <Link href={`/store/${active.vendor.slug}`}>
                ดูร้านและสินค้า →
              </Link>
            </>
          ) : (
            <p>ยังไม่มีร้านลงทะเบียนในอิ่มต่อ ไม่ได้ยืนยันว่าพื้นที่จริงว่าง</p>
          )}
          <p>{active.directions}</p>
        </div>
      )}
      <p className="map-note">
        ผังภายในตลาด ไม่ใช่เส้นทางเดินที่ตรวจสอบแล้ว
        ตำแหน่งที่ร้านแจ้งเองจะแสดงแยกจากตำแหน่งยืนยัน
      </p>
      <h2 className="mt-8 text-xl">รายชื่อร้านและล็อก</h2>
      <div className="map-list">
        {stalls
          .filter((s) =>
            `${s.code} ${s.vendor?.name || ""} ${s.zone}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((s) => (
            <button
              className="stall-list-item"
              key={s.id}
              onClick={() => setId(s.code)}
              aria-pressed={id === s.code}
            >
              <strong>
                โซน {s.zone} · {s.code}
              </strong>
              <span>{s.vendor?.name || "ยังไม่มีร้านลงทะเบียน"}</span>
              {s.vendor && (
                <small>
                  {s.vendor.status === "OPEN" ? "ยืนยันเปิด · " : "ตามตาราง · "}
                  {s.vendor.verified
                    ? "ยืนยันตำแหน่งแล้ว"
                    : "ร้านแจ้งตำแหน่งเอง"}
                </small>
              )}
            </button>
          ))}
      </div>
    </>
  );
}
