import { currentUser } from "@/lib/auth";
import { ApiForm, LoginButton } from "@/components/forms";
import { PageHeading } from "@/components/marketplace";
export const metadata = { title: "เปิดร้านกับอิ่มต่อ" };
export default async function BecomeVendor() {
  const user = await currentUser();
  return (
    <div className="shell page">
      <PageHeading title="เปิดร้านกับอิ่มต่อ" />
      <div className="two-col">
        <section className="form-panel">
          <h2>เริ่มต้นเปิดร้าน</h2>
          {user ? (
            <ApiForm
              endpoint="/api/stores"
              fields={[
                { name: "name", label: "ชื่อร้านค้า", required: true },
                {
                  name: "description",
                  label: "แนะนำร้านสั้น ๆ",
                  type: "textarea",
                },
                {
                  name: "kind",
                  label: "ขายที่ไหน?",
                  type: "select",
                  value: "MARKET",
                  required: true,
                  options: [
                    { value: "MARKET", label: "ร้านในตลาดนัด" },
                    { value: "PERMANENT", label: "ร้านประจำ" },
                    { value: "BOTH", label: "ทั้งร้านประจำและตลาดนัด" },
                  ],
                },
                { name: "address", label: "ที่อยู่หรือจุดสังเกตของร้านประจำ" },
                { name: "imageUrl", label: "ภาพร้านค้า", type: "upload" },
              ]}
              submit="สร้างร้านของฉัน"
              redirect="/merchant"
            />
          ) : (
            <>
              <p className="help-text mb-5">
                เข้าสู่ระบบด้วยบัญชี Google ก่อนเริ่มสร้างร้าน
              </p>
              <LoginButton enabled={!!process.env.AUTH_GOOGLE_ID} />
            </>
          )}
        </section>
        <section className="content-panel stack">
          <h2>ขั้นตอนเปิดร้าน</h2>
          <p>สร้างร้านด้วยบัญชี Google</p>
          <p>เลือกตลาดและล็อกที่คุณได้รับอนุญาตให้ขาย</p>
          <p>ถ่ายภาพ ตั้งราคา แล้วเผยแพร่สินค้า</p>
          <p>ขายเต็มราคาได้ หรือตั้งส่วนลดเมื่อต้องการ</p>
        </section>
      </div>
    </div>
  );
}
