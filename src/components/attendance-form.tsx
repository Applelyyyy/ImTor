"use client";
import { useState } from "react";
import type { MarketView } from "@/lib/contracts";
import { ApiForm } from "@/components/forms";
import { Field, FieldLabel } from "@/components/ui/field";
export function AttendanceForm({
  markets,
  storeId,
}: {
  markets: MarketView[];
  storeId: string;
}) {
  const sessions = markets.flatMap((m) =>
    m.sessions
      .filter((s) => !["CANCELLED", "FINISHED", "CLOSED"].includes(s.status))
      .map((s) => ({ ...s, market: m })),
  );
  const [id, setId] = useState(sessions[0]?.id || "");
  const session = sessions.find((s) => s.id === id);
  if (!session)
    return (
      <p className="help-text">
        ยังไม่มีรอบตลาดเปิดให้ลงทะเบียน กรุณารอผู้ดูแลเพิ่มตาราง
      </p>
    );
  return (
    <>
      <Field className="mb-6">
        <FieldLabel htmlFor="session-choice">เลือกตลาดและวันขาย</FieldLabel>
        <select
          id="session-choice"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {sessions.map((s) => (
            <option value={s.id} key={s.id}>
              {s.market.name} · {s.date}
            </option>
          ))}
        </select>
      </Field>
      <ApiForm
        key={id}
        endpoint="/api/attendance"
        body={{ storeId, sessionId: id }}
        fields={[
          {
            name: "stallId",
            label: "เลือกล็อกที่ได้รับอนุญาต",
            type: "select",
            required: true,
            options: session.market.stalls
              .filter((s) => s.active)
              .map((s) => ({
                value: s.id,
                label: `โซน ${s.zone} · ${s.code}${s.vendor ? " (มีร้านลงทะเบียน)" : ""}`,
              })),
          },
          {
            name: "expectedArrival",
            label: "เวลาที่คาดว่าจะถึง",
            type: "time",
          },
          { name: "sellingUntil", label: "ขายจนถึงเวลา", type: "time" },
          {
            name: "authorized",
            label:
              "ฉันมีสิทธิใช้พื้นที่นี้ และทราบว่าการเลือกในอิ่มต่อไม่ใช่ใบอนุญาตของตลาด",
            type: "checkbox",
            required: true,
          },
        ]}
        submit="บันทึกตารางและตำแหน่ง"
      />
    </>
  );
}
