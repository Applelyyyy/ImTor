import { db } from "@/lib/db";
import { requireAdmin } from "@/components/auth-guard";
import { AdminTable } from "@/components/admin";
import { ApiButton } from "@/components/forms";
export default async function Users() {
  const actor = await requireAdmin();
  const total = await db.user.count();
  const rows = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return (
    <AdminTable
      title="ผู้ใช้งาน"
      description="ค้นหาและแบ่งหน้าข้อมูลที่โหลด สิทธิ์ระดับสูงจัดการได้โดยผู้ดูแลสูงสุดเท่านั้น"
      headers={["ชื่อ / อีเมล", "สิทธิ์", "สถานะ", "จัดการ"]}
      total={total}
      searchValues={rows.map((r) => `${r.id} ${r.name ?? ""} ${r.email ?? ""} ${r.role} ${r.suspended ? "ระงับ" : "ปกติ"} ${r.demoBatchId ? "สาธิต" : "จริง"}`)}
      rows={rows.map((r) => [
        <div key="name">
          <strong>{r.name || "ไม่ระบุชื่อ"}</strong>
          <div className="help-text">{r.email}</div>
          {r.demoBatchId && <small>บัญชีสมมติ · สาธิต</small>}
        </div>,
        r.role,
        r.suspended ? "ระงับ" : "ปกติ",
        <div className="actions" key="actions">
          <ApiButton
            endpoint={`/api/admin/users/${r.id}`}
            body={{ suspended: !r.suspended }}
          >
            {r.suspended ? "ปลดระงับ" : "ระงับผู้ใช้"}
          </ApiButton>
          {actor.role === "SUPERADMIN" && (
            <ApiButton
              endpoint={`/api/admin/users/${r.id}`}
              body={{ role: r.role === "USER" ? "ADMIN" : "USER" }}
              confirmMessage="ยืนยันเปลี่ยนสิทธิ์ผู้ใช้นี้?"
            >
              {r.role === "USER" ? "ตั้งเป็นผู้ดูแล" : "ตั้งเป็นผู้ใช้"}
            </ApiButton>
          )}
        </div>,
      ])}
    />
  );
}
