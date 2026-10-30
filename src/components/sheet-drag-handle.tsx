'use client';
import {useEffect,useRef} from 'react';
import {animateMotion,motionMs,springFrames} from '@/lib/motion';
/** Drag only this handle; the sheet's scrollable contents retain native touch scrolling. */
export function SheetDragHandle({onDismiss}: {onDismiss:()=>void}) {
 const drag=useRef<{pointer:number;y:number;time:number;distance:number}|null>(null),animation=useRef<Animation|null>(null),suppressClick=useRef(false);
 useEffect(()=>()=>animation.current?.cancel(),[]);
 const reset=(target:HTMLElement,distance:number)=>{
  target.style.removeProperty('--sheet-drag-y');
  animation.current=animateMotion(target,springFrames({y:distance}),motionMs(target,'--motion-spring',300),'linear');
 };
 return <button type="button" className="sheet-drag-handle" aria-label="ปิดรายละเอียดล็อก" onClick={event=>{if(suppressClick.current){event.preventDefault();suppressClick.current=false;}else onDismiss();}}
  onPointerDown={event=>{
   if(!event.isPrimary || event.button!==0)return;
   const target=event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]');if(!target)return;
   animation.current?.cancel();drag.current={pointer:event.pointerId,y:event.clientY,time:performance.now(),distance:0};suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event=>{
   const current=drag.current;if(!current || current.pointer!==event.pointerId)return;
   current.distance=Math.max(0,event.clientY-current.y);if(current.distance>5)suppressClick.current=true;
   event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]')?.style.setProperty('--sheet-drag-y',`${current.distance}px`);
  }}
  onPointerUp={event=>{
   const current=drag.current;if(!current || current.pointer!==event.pointerId)return;drag.current=null;
   const target=event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]');if(!target)return;
   if(current.distance>96 || (current.distance>32 && current.distance/Math.max(1,performance.now()-current.time)>.55))onDismiss();else reset(target,current.distance);
  }}
  onPointerCancel={event=>{
   const current=drag.current;drag.current=null;const target=event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]');if(current&&target)reset(target,current.distance);
  }}/>;
}
