import { describe,it,expect,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPickupQr,parsePickupQr } from '@/lib/pickup-qr';
vi.mock('@/lib/queries',()=>({publicFeatures:async()=>({foodRescueEnabled:true,reservationsEnabled:true})}));
import { CategoryFilters } from '@/components/marketplace';
describe('pickup QR and stable interface',()=>{
 it('round-trips a real generated QR through the actual scanner decoder',async()=>{
  const payload=createPickupQr('reservation-with:legacy-id','0123456789ABCDEF');
  const png=await QRCode.toBuffer(payload,{margin:4,width:400,errorCorrectionLevel:'M'});
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
  expect(parsePickupQr(decoded!.data)).toEqual({type:'imtor.pickup',v:1,id:'reservation-with:legacy-id',code:'0123456789ABCDEF'});
 });
 it.each(['https://evil.example/pickup','{}','{"type":"imtor.pickup","v":2,"id":"x","code":"x"}','x'.repeat(1025)])('rejects unrelated and malformed QR without echoing its content',value=>{expect(()=>parsePickupQr(value)).toThrow('QR นี้ไม่ใช่รหัสรับสินค้าของอิ่มต่อ');});
 it('renders category labels without hidden spinners or asymmetric pending-link padding',async()=>{const html=renderToStaticMarkup(await CategoryFilters({categories:[{id:'x',name:'อาหาร'}],q:'ข้าว'}));expect(html).not.toContain('pending-link');expect(html).not.toContain('navigation-pending');expect(html).not.toContain('<svg class="lucide lucide-loader');expect(html).toContain('aria-current="page"');expect(html).toContain('q=');});
 it('protects the shared app-shell inset for all scroll-locked overlays',()=>{const css=readFileSync('src/app/globals.css','utf8');expect(css).toMatch(/html body\[data-scroll-locked\]\s*\{\s*padding-top: calc\(var\(--site-header-height\).*?!important;/s);});
});
