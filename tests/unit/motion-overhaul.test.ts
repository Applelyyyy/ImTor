import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {animateMotion,springFrames} from '@/lib/motion';
const css=readFileSync('src/app/globals.css','utf8');
describe('motion overhaul',()=>{
 it('settles a bounded spring at the exact target without frame-time React work',()=>{
  const frames=springFrames({x:200,y:0,scaleX:.7});
  expect(frames).toHaveLength(31);
  expect(frames[0].transform).toBe('translate(200px, 0px) scale(0.7, 1)');
  expect(frames.at(-1)?.transform).toBe('translate(0px, 0px) scale(1, 1)');
  expect(frames.every(f=>Number.isFinite(f.offset))).toBe(true);
 });
 it('cancels active native motion when reduced motion is enabled and removes its listener',async()=>{
  let changed:(()=>void)|undefined;
  const preference={matches:false,addEventListener:vi.fn((_name:string,callback:()=>void)=>{changed=callback;}),removeEventListener:vi.fn()};
  const animation={cancel:vi.fn(),finished:Promise.resolve()};
  const element={animate:vi.fn(()=>animation)};
  vi.stubGlobal('window',{matchMedia:()=>preference});
  try{
   expect(animateMotion(element as unknown as Element,[{opacity:0},{opacity:1}],200)).toBe(animation);
   preference.matches=true;changed?.();expect(animation.cancel).toHaveBeenCalledOnce();
   await Promise.resolve();expect(preference.removeEventListener).toHaveBeenCalledOnce();
   expect(animateMotion(element as unknown as Element,[],200)).toBeNull();expect(element.animate).toHaveBeenCalledOnce();
  }finally{vi.unstubAllGlobals();}
 });
 it('bounds expressive motion and keeps Radix positioning separate from animation',()=>{
  expect(css).toContain('--motion-expressive: 280ms');
  expect(css).toContain('--motion-exit: 160ms');
  expect(css).toContain('@keyframes imtor-dialog-in');
  expect(css).toContain('scale: .96');
  expect(css).toContain('[data-slot="sheet-content"][data-side="bottom"]');
  expect(css).toContain('.product-grid > .product-card:nth-child(-n + 8)');
  expect(css).not.toContain('will-change:');
  expect(css).toContain('.product-card:hover, .product-card:hover .product-photo img,');
 });
 it('keeps native motion cancellable and respects preferences changed during playback',()=>{
  const source=readFileSync('src/lib/motion.ts','utf8');
  expect(source).toContain('prefers-reduced-motion: reduce');
  expect(source).toContain('animation.cancel()');
  expect(source).toContain('removeEventListener');
  expect(source).not.toContain('requestAnimationFrame');
 });
 it('preserves explicit reset, queues mid-zoom selection and stops native movement on preference change',()=>{
  const source=readFileSync('src/components/market-map-canvas.tsx','utf8');
  expect(source).toContain('previous.reset?0:');
  expect(source).toContain('pendingCenter.current=()=>center(smooth)');
  expect(source).toContain("preference.addEventListener('change',reduce)");
  expect(source).toContain('if(moved || !zooming.current)center(moved)');
 });
 it('uses authoritative feedback only when the value actually changes',()=>{
  const source=readFileSync('src/components/change-feedback.tsx','utf8');
  expect(source).toContain('previous.current !== value');
  expect(readFileSync('src/components/inventory-controls.tsx','utf8')).toContain('<ChangeFeedback value={current}');
 });
});
