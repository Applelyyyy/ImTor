export class RequestError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}
/** A write is confirmed only by a complete API envelope, not by HTTP headers alone. */
export async function request(url: string, method: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(url, {
      method, headers: {"Content-Type":"application/json"},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RequestError("การเชื่อมต่อขัดข้อง กรุณาตรวจสอบรายการแล้วลองอีกครั้ง");
  }
  const envelope = await response.json().catch(()=>null);
  if (!response.ok) {
    throw new RequestError(response.status === 401 ? "กรุณาเข้าสู่ระบบ" : envelope?.error?.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง", response.status);
  }
  if (!envelope || typeof envelope !== "object" || envelope.data === undefined || envelope.data === null)
    throw new RequestError("ยังไม่ได้รับผลยืนยันจากระบบ กรุณาตรวจสอบรายการก่อนลองอีกครั้ง");
  return envelope.data;
}
