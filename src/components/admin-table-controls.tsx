"use client";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Nodes are rendered by the authorized server page; only searchable text crosses as data. */
export function AdminTableControls({ headers, rows, searchValues, total }: {
  headers: string[];
  rows: ReactNode[][];
  searchValues: string[];
  total: number;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const needle = query.trim().toLocaleLowerCase("th");
  const filtered = rows.filter((_, i) => (searchValues[i] || "").toLocaleLowerCase("th").includes(needle));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(activePage * pageSize, (activePage + 1) * pageSize);
  return <>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label htmlFor={`${id}-search`} className="mb-2 block text-sm">ค้นหาในรายการที่โหลด</label>
        <Input id={`${id}-search`} type="search" value={query} placeholder="ค้นหาชื่อ สถานะ หรือรหัส" onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
      </div>
      <label className="flex flex-col gap-2 text-sm" htmlFor={`${id}-size`}>รายการต่อหน้า
        <select id={`${id}-size`} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
          {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
    <p className="help-text mb-3" role="status">พบ {filtered.length} รายการ · โหลด {rows.length} จากทั้งหมด {total} รายการ</p>
    {total > rows.length && <p role="note" className="mb-3 text-sm">แสดงข้อมูลล่าสุดสูงสุด 1,000 รายการ การค้นหานี้ครอบคลุมเฉพาะข้อมูลที่โหลด ไม่ใช่ทั้งฐานข้อมูล</p>}
    <div className="data-table-wrap">
      <table className="data-table" role="table">
        <thead role="rowgroup"><tr role="row">{headers.map((h) => <th key={h} scope="col" role="columnheader">{h}</th>)}</tr></thead>
        <tbody role="rowgroup">{visible.map((row, i) => <tr key={`${activePage}:${i}`} role="row">{row.map((cell, j) => <td key={j} role="cell" data-label={headers[j]}>{cell}</td>)}</tr>)}</tbody>
      </table>
      {!visible.length && <p className="p-5">ไม่พบรายการที่ตรงกับคำค้น</p>}
    </div>
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="หน้ารายการ">
      <Button variant="outline" size="sm" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>ก่อนหน้า</Button>
      <span className="text-sm">หน้า {activePage + 1} / {pageCount}</span>
      <Button variant="outline" size="sm" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}>ถัดไป</Button>
    </nav>
  </>;
}
