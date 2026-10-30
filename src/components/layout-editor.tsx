"use client";
import { useState } from "react";
import Image from "next/image";
import { ApiForm } from "@/components/forms";
import { Field, FieldLabel } from "@/components/ui/field";
export function LayoutEditor({
  marketId,
  image,
  zones,
  stalls,
}: {
  marketId: string;
  image: string | null;
  zones: { id: string; name: string }[];
  stalls: {
    id: string;
    code: string;
    zoneId: string;
    x: number;
    y: number;
    directions: string;
    active: boolean;
  }[];
}) {
  const [id, setId] = useState(""),
    [point, setPoint] = useState({ x: 0.5, y: 0.5 });
  const stall = stalls.find((s) => s.id === id);
  return (
    <div className="stack">
      <div>
        <Field className="mb-5">
          <FieldLabel htmlFor="edit-stall">
            เลือกล็อกเพื่อแก้ไข หรือสร้างล็อกใหม่
          </FieldLabel>
          <select
            id="edit-stall"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              const s = stalls.find((s) => s.id === e.target.value);
              if (s) setPoint({ x: s.x, y: s.y });
            }}
          >
            <option value="">+ เพิ่มล็อกใหม่</option>
            {stalls.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
                {s.active ? "" : " (ปิดใช้งาน)"}
              </option>
            ))}
          </select>
        </Field>
        <p className="help-text mb-3">
          คลิกบนผังเพื่อเลือกตำแหน่ง จากนั้นกดบันทึก
          ข้อมูลตำแหน่งเก็บเป็นสัดส่วน 0–1 รองรับทุกขนาดหน้าจอ
        </p>
        <div
          className="map-canvas"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPoint({
              x: Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)),
              y: Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height)),
            });
          }}
        >
          {image && (
            <Image src={image} alt="ภาพผังตลาดที่อัปโหลด" fill sizes="100vw" />
          )}
          <div className="map-grid" />
          {stalls.map((s) => (
            <span
              key={s.id}
              className={`stall-marker${s.id === id ? " selected" : ""}`}
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
            >
              {s.code}
            </span>
          ))}
          <span
            className="stall-marker occupied selected"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          >
            ตำแหน่งใหม่
          </span>
        </div>
      </div>
      <div className="form-panel">
        <h2>{stall ? "แก้ไขล็อก " + stall.code : "เพิ่มล็อกในตลาด"}</h2>
        {zones.length ? (
          <ApiForm
            key={`${id}:${point.x}:${point.y}`}
            endpoint={
              stall
                ? `/api/admin/stalls/${stall.id}`
                : `/api/admin/markets/${marketId}/stalls`
            }
            method={stall ? "PATCH" : "POST"}
            fields={[
              {
                name: "zoneId",
                label: "โซน",
                type: "select",
                required: true,
                value: stall?.zoneId,
                options: zones.map((z) => ({ value: z.id, label: z.name })),
              },
              {
                name: "code",
                label: "รหัสล็อก",
                required: true,
                value: stall?.code,
              },
              {
                name: "x",
                label: "ตำแหน่งแนวนอน X (0–1)",
                type: "number",
                step: "any",
                min: 0,
                max: 1,
                required: true,
                value: point.x,
              },
              {
                name: "y",
                label: "ตำแหน่งแนวตั้ง Y (0–1)",
                type: "number",
                step: "any",
                min: 0,
                max: 1,
                required: true,
                value: point.y,
              },
              {
                name: "directions",
                label: "จุดสังเกตหรือทางเดิน",
                value: stall?.directions,
              },
              {
                name: "active",
                label: "เปิดใช้งานล็อก",
                type: "checkbox",
                value: stall?.active ?? true,
              },
            ]}
            submit="บันทึกล็อกและตำแหน่ง"
          />
        ) : (
          <p>เพิ่มโซนก่อนเพิ่มล็อก</p>
        )}
      </div>
    </div>
  );
}
