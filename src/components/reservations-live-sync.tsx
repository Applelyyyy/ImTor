'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
type Snapshot = { id: string; status: string; expiresAt: string };
export function ReservationsLiveSync({ rows }: { rows: Snapshot[] }) {
  const router = useRouter();
  const signature = JSON.stringify(rows.map(({id,status}) => `${id}:${status}`).sort());
  const pending = rows.filter(r => r.status === 'RESERVED');
  const nextExpiry = Math.min(...pending.map(r => +new Date(r.expiresAt)));
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    let disposed = false, busy = false, refreshed = false;
    let controller: AbortController | undefined;
    async function update() {
      if (disposed || busy || refreshed || document.hidden) return;
      busy = true; controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch('/api/reservations/status', { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { refreshed = true; router.refresh(); return; }
        if (!response.ok) return;
        const envelope = await response.json();
        if (!Array.isArray(envelope.data)) return;
        const next = envelope.data as Snapshot[];
        const changed = JSON.stringify(next.map(({id,status}) => `${id}:${status}`).sort()) !== signature;
        if (changed || Date.now() >= nextExpiry) {
          refreshed = true;
          if (changed && next.some(r => r.status === 'COMPLETED' && JSON.parse(signature).includes(`${r.id}:RESERVED`)))
            toast.success('ยืนยันรับสินค้าแล้ว', {id:'pickup-synced'});
          router.refresh();
        }
      } catch { /* A transient status read never changes the displayed business state. */ }
      finally { clearTimeout(timeout); busy = false; }
    }
    const timer = setInterval(() => void update(), 2000);
    const visible = () => { if (document.hidden) controller?.abort(); else void update(); };
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange',visible); window.removeEventListener('focus',visible); };
  }, [signature, nextExpiry, router]);
  return null;
}
