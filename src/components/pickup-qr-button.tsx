'use client';
import { useState } from 'react';
import Image from 'next/image';
import { QrCode } from 'lucide-react';
import { AppDialog } from './app-dialog';
import { Button } from './ui/button';
export function PickupQrButton({ image, code }: { image: string; code: string }) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}><QrCode aria-hidden="true" />แสดง QR รับสินค้า</Button>
    <AppDialog open={open} onOpenChange={setOpen} title="QR รับสินค้า" description="ให้ร้านค้าสแกน QR นี้เพื่อยืนยันส่งมอบสินค้า">
      <div className="pickup-qr-panel"><Image className="pickup-qr-image" src={image} alt="QR สำหรับรับสินค้ารายการนี้" width={280} height={280} unoptimized />
        <p>ให้ร้านค้าสแกนเพื่อยืนยันรับสินค้า</p>
        <details><summary>รหัสสำรอง</summary><code className="pickup-code">{code}</code></details>
      </div>
    </AppDialog></>;
}
