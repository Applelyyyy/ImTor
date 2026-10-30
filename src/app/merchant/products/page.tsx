import Link from "next/link";
import { merchantStore, NoStore } from "@/components/merchant";
import { PageHeading, EmptyState } from "@/components/marketplace";
import { ApiButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";
export default async function MerchantProducts() {
  const s = await merchantStore();
  if (!s) return <NoStore />;
  return (
    <>
      <PageHeading
        title="สินค้าในร้าน"
        description="เพิ่ม แก้ไข และตั้งเวลาลดราคาได้ในที่เดียว"
      >
        <Button asChild>
          <Link href="/merchant/products/new">+ เพิ่มสินค้า</Link>
        </Button>
      </PageHeading>
      {!s.products.length ? (
        <EmptyState
          title="สินค้าชิ้นแรกของร้าน"
          description="เพิ่มภาพและราคา แล้วเริ่มให้ลูกค้าค้นพบร้านคุณ"
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>ราคา</th>
                <th>คงเหลือ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {s.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="help-text">{p.category.name}</div>
                  </td>
                  <td>{money(p.price)}</td>
                  <td>{p.stock ?? "ไม่จำกัด"}</td>
                  <td>
                    {p.archived
                      ? "เก็บเข้าคลัง"
                      : p.published
                        ? "เผยแพร่"
                        : "ซ่อน"}
                  </td>
                  <td>
                    <div className="actions">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/merchant/products/${p.id}/edit`}>
                          แก้ไข / ส่วนลด
                        </Link>
                      </Button>
                      <ApiButton
                        endpoint={`/api/products/${p.id}`}
                        body={{ published: !p.published }}
                      >
                        {p.published ? "ซ่อน" : "เผยแพร่"}
                      </ApiButton>
                      <ApiButton
                        endpoint={`/api/products/${p.id}/duplicate`}
                        method="POST"
                      >
                        ทำซ้ำ
                      </ApiButton>
                      <ApiButton
                        endpoint={`/api/products/${p.id}`}
                        body={{ archived: !p.archived }}
                      >
                        {p.archived ? "นำกลับ" : "เข้าคลัง"}
                      </ApiButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
