import { requireAdmin } from "@/components/auth-guard";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/marketplace";
import { SettingsForm } from "@/components/settings-form";
export default async function Settings() {
  await requireAdmin();
  const settings = await db.systemSetting.findMany();
  return (
    <>
      <PageHeading
        title="ตั้งค่าระบบ"
        description="จัดการค่าทั่วไปของแอป ไม่เก็บรหัสผ่านหรือคีย์ลับในหน้านี้"
      />
      <div className="stack">
        <div className="form-panel">
          <h2>เพิ่มหรือแก้ไขค่า</h2>
          <SettingsForm />
        </div>
        <div className="content-panel">
          <h2>ค่าที่บันทึกไว้</h2>
          {settings.map((s) => (
            <div className="session-row" key={s.key}>
              <strong>{s.key}</strong>
              <pre className="help-text whitespace-pre-wrap break-all">
                {JSON.stringify(s.value, null, 2)}
              </pre>
            </div>
          ))}
          {!settings.length && <p>ยังไม่มีค่าที่กำหนดเอง</p>}
        </div>
      </div>
    </>
  );
}
