import { merchantStore, NoStore } from "@/components/merchant";
import { PageHeading } from "@/components/marketplace";
import { ApiForm } from "@/components/forms";
export default async function MerchantSettings() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  return (
    <>
      <PageHeading
        title="ตั้งค่าร้านค้า"
        description="เล่าเรื่องร้านและบอกตำแหน่งให้ลูกค้าหาเจอ"
      />
      <div className="form-panel">
        <ApiForm
          endpoint={`/api/stores/${s.id}`}
          method="PATCH"
          fields={[
            { name: "name", label: "ชื่อร้าน", required: true, value: s.name },
            {
              name: "description",
              label: "เกี่ยวกับร้าน",
              type: "textarea",
              value: s.description,
            },
            {
              name: "kind",
              label: "รูปแบบร้าน",
              type: "select",
              value: s.kind,
              required: true,
              options: [
                { value: "MARKET", label: "ตลาดนัด" },
                { value: "PERMANENT", label: "ร้านประจำ" },
                { value: "BOTH", label: "ร้านประจำและตลาดนัด" },
              ],
            },
            { name: "address", label: "ที่อยู่ร้านประจำ", value: s.address },
            {
              name: "imageUrl",
              label: "ภาพร้าน",
              type: "upload",
              value: s.imageUrl,
            },
            {
              name: "latitude",
              label: "ละติจูดร้านประจำ",
              type: "number",
              step: "any",
              min: -90,
              max: 90,
              value: s.latitude,
            },
            {
              name: "longitude",
              label: "ลองจิจูดร้านประจำ",
              type: "number",
              step: "any",
              min: -180,
              max: 180,
              value: s.longitude,
            },
          ]}
          submit="บันทึกข้อมูลร้าน"
        />
      </div>
    </>
  );
}
