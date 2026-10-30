'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, ScanLine } from 'lucide-react';
import { parsePickupQr } from '@/lib/pickup-qr';
import { AppDialog } from './app-dialog';
import { Button } from './ui/button';
type Receipt = { id: string; quantity: number; productName?: string; storeName?: string; status: string; alreadyCompleted: boolean };
export function PickupScanner({ storeId }: { storeId?: string }) {
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false);
  return <><Button onClick={() => setOpen(true)}><ScanLine aria-hidden="true" />สแกน QR รับสินค้า</Button>
    <AppDialog open={open} onOpenChange={setOpen} title="สแกน QR รับสินค้า" description="สแกน QR ของลูกค้าเพื่อยืนยันส่งมอบสินค้า" busy={busy}>
      {open && <Scanner storeId={storeId} onBusyChange={setBusy} />}
    </AppDialog></>;
}
function Scanner({storeId,onBusyChange}: {storeId?:string;onBusyChange:(busy:boolean)=>void}) {
  const router = useRouter(), fileId = useId();
  const video = useRef<HTMLVideoElement>(null), input = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null), frame = useRef(0), generation = useRef(0);
  const request = useRef<AbortController | null>(null), alive = useRef(true), locked = useRef(false), pending = useRef<string | null>(null);
  const [camera,setCamera] = useState<'loading'|'active'|'paused'>('loading');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [receipt,setReceipt] = useState<Receipt | null>(null), [canRetry,setCanRetry] = useState(false);
  const stop = useCallback(() => {
    generation.current++; cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
  },[]);
  const complete = useCallback(async (payload:string) => {
    if (locked.current) return;
    locked.current = true; stop();
    try { parsePickupQr(payload); }
    catch { setError('QR นี้ไม่ใช่รหัสรับสินค้าของอิ่มต่อ'); setCamera('paused'); locked.current = false; return; }
    pending.current = payload; setCanRetry(true); setError(''); setBusy(true); onBusyChange(true);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetch('/api/reservations/pickup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,...(storeId?{storeId}:{})}),signal:controller.signal});
      const envelope = await response.json().catch(() => null);
      if (!response.ok || envelope?.data?.status !== 'COMPLETED') throw new Error(envelope?.error?.message || 'ยังยืนยันไม่ได้ กรุณาลองอีกครั้ง');
      if (alive.current) { setReceipt(envelope.data as Receipt); setCanRetry(false); pending.current = null; router.refresh(); }
    } catch (cause) {
      if (alive.current) { setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'การเชื่อมต่อขัดข้อง กรุณาลองยืนยันอีกครั้ง'); setCamera('paused'); }
    } finally { clearTimeout(timeout); if (alive.current) { setBusy(false); onBusyChange(false); } }
  },[onBusyChange,router,stop,storeId]);
  const start = useCallback(async () => {
    stop(); const token = generation.current;
    try {
      const {default:decode} = await import('jsqr');
      if (!alive.current || token !== generation.current) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('อุปกรณ์นี้เปิดกล้องไม่ได้ เลือกรูป QR แทนได้');
      const media = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
      if (!alive.current || token !== generation.current || document.hidden) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; const element = video.current;
      if (!element) { stop(); return; }
      element.srcObject = media; await element.play();
      if (!alive.current || token !== generation.current) { stop(); return; }
      setCamera('active'); const canvas = document.createElement('canvas'),context = canvas.getContext('2d',{willReadFrequently:true}); let previous = 0;
      const scan = (now:number) => {
        if (!alive.current || token !== generation.current || locked.current) return;
        if (now-previous >= 250 && element.readyState >= 2 && element.videoWidth && context) {
          previous=now; canvas.width=Math.min(720,element.videoWidth); canvas.height=Math.round(canvas.width*element.videoHeight/element.videoWidth);
          context.drawImage(element,0,0,canvas.width,canvas.height); const pixels=context.getImageData(0,0,canvas.width,canvas.height);
          const result=decode(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});
          if (result) { void complete(result.data); return; }
        }
        frame.current=requestAnimationFrame(scan);
      };
      frame.current=requestAnimationFrame(scan);
    } catch (cause) {
      if (alive.current && token === generation.current) { stop(); setCamera('paused'); setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'กรุณาอนุญาตกล้อง หรือเลือกรูป QR' : 'เปิดกล้องไม่ได้ เลือกรูป QR แทนได้'); }
    }
  },[complete,stop]);
  useEffect(() => {
    alive.current=true; const opening = requestAnimationFrame(() => void start());
    const visibility = () => { if (document.hidden) { stop(); if (!locked.current) setCamera('paused'); } };
    document.addEventListener('visibilitychange',visibility);
    return () => { cancelAnimationFrame(opening); alive.current=false; stop(); request.current?.abort(); document.removeEventListener('visibilitychange',visibility); };
  },[start,stop]);
  async function scanFile(file:File|undefined) {
    if (!file || busy) return;
    locked.current=false;pending.current=null;setCanRetry(false);stop(); const token=generation.current; setCamera('paused'); setError('');
    if (file.size>5*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) { setError('เลือกรูป PNG, JPG หรือ WebP ไม่เกิน 5 MB'); return; }
    try {
      const bitmap=await createImageBitmap(file);
      try {
        if (bitmap.width*bitmap.height>24_000_000) throw new Error('รูปใหญ่เกินไป กรุณาเลือกรูปใหม่');
        const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
        const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('อ่านรูปไม่ได้');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const {default:decode}=await import('jsqr'),pixels=context.getImageData(0,0,canvas.width,canvas.height),result=decode(pixels.data,pixels.width,pixels.height);
        if(!result)throw new Error('ไม่พบ QR ในรูป กรุณาเลือกรูปใหม่');
        if(alive.current && token===generation.current)await complete(result.data);
      }finally{bitmap.close();}
    }catch(cause){if(alive.current && token===generation.current)setError(cause instanceof Error && cause.message.startsWith('ไม่พบ QR')?cause.message:'อ่าน QR ไม่ได้ กรุณาเลือกรูปใหม่');}
    finally{if(input.current)input.current.value='';}
  }
  function restart(){locked.current=false;pending.current=null;setCanRetry(false);setReceipt(null);setError('');setCamera('loading');void start();}
  return <div className="pickup-scanner" aria-busy={busy}>
    {receipt ? <><div className="pickup-scan-success" data-replayed={receipt.alreadyCompleted} role="status"><h3>{receipt.alreadyCompleted ? "รายการนี้รับสินค้าแล้ว" : "ยืนยันรับสินค้าแล้ว"}</h3>{receipt.alreadyCompleted && <p>ไม่ต้องส่งมอบซ้ำ</p>}<p>{receipt.productName}</p><p>{receipt.storeName} · {receipt.quantity} ชิ้น</p></div><Button onClick={restart}>สแกนรายการถัดไป</Button></> : <>
      <video ref={video} muted playsInline aria-label="ภาพจากกล้องสำหรับสแกน QR" />
      <p role="status">{busy?'กำลังยืนยันรับสินค้า…':camera==='loading'?'กำลังเปิดกล้อง…':camera==='active'?'วาง QR ของลูกค้าในกรอบกล้อง':'กล้องหยุดอยู่'}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pickup-scanner-actions">
        {!busy && camera==='paused' && <Button variant="outline" onClick={restart}><Camera aria-hidden="true" />เปิดกล้องอีกครั้ง</Button>}
        <Button variant="outline" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus aria-hidden="true" />เลือกรูป QR</Button>
        {error && canRetry && <Button disabled={busy} onClick={()=>{locked.current=false;void complete(pending.current!);}}>ลองยืนยันอีกครั้ง</Button>}
      </div>
      <input ref={input} id={fileId} type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูป QR" className="sr-only" tabIndex={-1} disabled={busy} onChange={event=>void scanFile(event.target.files?.[0])}/>
    </>}
  </div>;
}
