"use client";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="shell page">
      <Alert variant="destructive">
        <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
        <AlertDescription>
          การเชื่อมต่ออาจขัดข้อง กรุณาลองอีกครั้ง
          หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ
        </AlertDescription>
      </Alert>
      <Button onClick={reset} className="mt-6">
        ลองอีกครั้ง
      </Button>
    </div>
  );
}
