"use client";

import { useEffect, useLayoutEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {animateMotion,motionMs} from "@/lib/motion";
import { cn } from "@/lib/utils";
import { groupByPoint, imageAspectRatio, SCHEMATIC_ASPECT_RATIO, zoneLabels } from "@/lib/market-map";
import styles from "./market-map-canvas.module.css";

export type MarketMapStall = {
  id: string; code: string; x: number; y: number; zone: string;
  status: "available" | "unavailable" | "own" | "occupied";
  detail?: string;
};
const statuses: Record<MarketMapStall["status"], string> = {
  available: "เลือกได้", unavailable: "ไม่ว่าง", own: "ล็อกของคุณ", occupied: "มีร้าน",
};

/** Shared geometry/background for selection, public discovery, and admin editing.
 * Images define the coordinate plane: no object-fit letterboxing under markers. */
export function MarketMapSurface({ layoutImage, name, children, className, style, ...props }: {
  layoutImage?: string | null; name: string; children: ReactNode; ref?: Ref<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>) {
  const [loadedImage, setLoadedImage] = useState<{ src: string; ratio: number } | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hasImage = !!layoutImage && failedImage !== layoutImage;
  const ratio = hasImage && loadedImage?.src === layoutImage ? loadedImage.ratio : SCHEMATIC_ASPECT_RATIO;
  return <div {...props} className={cn(styles.surface, className)} style={{ ...style, aspectRatio: ratio }} data-map-canvas="" data-schematic={!hasImage}>
    {hasImage && <Image key={layoutImage} src={layoutImage} alt={`ผังตลาด ${name}`} fill loading="eager" sizes="(min-width: 768px) 70vw, 100vw"
      className={styles.layoutImage} onLoad={(event) => setLoadedImage({ src: layoutImage, ratio: imageAspectRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight) })}
      onError={() => setFailedImage(layoutImage)} />}
    {!hasImage && <p className={styles.schematic}>แผนผังตลาด</p>}
    {children}
  </div>;
}

export function MarketMapCanvas({ name, layoutImage, entrance, stalls, selectedId, onSelect, controlsId, markerRef, disabled = false, mode = "selection" }: {
  name: string; layoutImage?: string | null; entrance?: string | null;
  stalls: readonly MarketMapStall[]; selectedId?: string;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
  controlsId?: string;
  markerRef?: (id: string, node: HTMLButtonElement | null) => void;
  disabled?: boolean;
  mode?: "selection" | "public";
}) {
  const [zoom, setZoom] = useState(1);
  const stage=useRef<HTMLDivElement>(null),zoomAnimation=useRef<Animation|null>(null),zooming=useRef(false);
  const beforeZoom=useRef<{width:number;height:number;left:number;top:number;reset:boolean}|null>(null);
  const pendingCenter=useRef<(()=>void)|null>(null);
  function changeZoom(next:number,reset=false) {
    const plane=stage.current,view=viewport.current;if(!plane||!view)return;
    if(next===zoom){if(reset)view.scrollTo({left:0,top:0,behavior:'instant'});return;}
    zoomAnimation.current?.finish();zoomAnimation.current?.cancel();
    const rect=plane.getBoundingClientRect();beforeZoom.current={width:rect.width,height:rect.height,left:view.scrollLeft,top:view.scrollTop,reset};
    zooming.current=true;setZoom(next);
  }
  useLayoutEffect(()=>{
    const plane=stage.current,view=viewport.current,previous=beforeZoom.current;beforeZoom.current=null;
    if(!plane||!view||!previous)return;
    const target=plane.getBoundingClientRect();
    view.scrollLeft=previous.reset?0:(previous.left+view.clientWidth/2)*target.width/previous.width-view.clientWidth/2;
    view.scrollTop=previous.reset?0:(previous.top+view.clientHeight/2)*target.height/previous.height-view.clientHeight/2;
    const animation=animateMotion(plane,[{transform:`translate(${view.scrollLeft-previous.left}px, ${view.scrollTop-previous.top}px) scale(${previous.width/target.width}, ${previous.height/target.height})`},{transform:'none'}],motionMs(plane,'--motion-feedback',200));
    zoomAnimation.current=animation;
    const finished=()=>{
      if(zoomAnimation.current!==animation)return;
      zooming.current=false;const center=pendingCenter.current;pendingCenter.current=null;center?.();
    };
    if(animation)void animation.finished.then(finished,finished);else finished();
  },[zoom]);
  useEffect(()=>()=>zoomAnimation.current?.cancel(),[]);
  const [clusterKey, setClusterKey] = useState<string | null>(null);
  const chooserId = useId();
  const chooser = useRef<HTMLElement>(null);
  const clusterTrigger = useRef<HTMLButtonElement | null>(null);
  const groups = groupByPoint(stalls);
  const cluster = groups.find((group) => group.key === clusterKey && group.stalls.length > 1);
  useEffect(() => {
    if (clusterKey) chooser.current?.querySelector<HTMLButtonElement>("[data-cluster-choice]")?.focus();
  }, [clusterKey]);
  function closeChooser() {
    setClusterKey(null);
    clusterTrigger.current?.focus({ preventScroll: true });
  }
  const viewport = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const gesture = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const previousSelection=useRef(selectedId);
  const minWidth = Math.max(360, Math.min(960, Math.ceil(Math.sqrt(stalls.length)) * 110));
  useEffect(() => {
    const element = viewport.current, marker = selectedId ? markers.current.get(selectedId) : null;
    if (!element || !marker) return;
    const moved=previousSelection.current!==selectedId;previousSelection.current=selectedId;
    const center = (smooth=false) => {
      // Loading an image or resizing its column changes the coordinate plane.
      // Only scroll this viewport, and never fight an in-progress pan gesture.
      if (gesture.current) return;
      if (zooming.current) {pendingCenter.current=()=>center(smooth);return;}
      const bounds = element.getBoundingClientRect(), target = marker.getBoundingClientRect();
      element.scrollTo({ left: element.scrollLeft + target.left - bounds.left - bounds.width / 2 + target.width / 2,
        top: element.scrollTop + target.top - bounds.top - bounds.height / 2 + target.height / 2, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
    };
    if(moved || !zooming.current)center(moved);
    const surface = element.querySelector<HTMLElement>("[data-map-canvas]");
    if (!surface) return;
    let width=surface.clientWidth,height=surface.clientHeight;
    const observer = new ResizeObserver(() => {
      if(surface.clientWidth===width && surface.clientHeight===height)return;
      width=surface.clientWidth;height=surface.clientHeight;center();
    });
    observer.observe(surface);
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{if(preference.matches)center();};
    preference.addEventListener('change',reduce);
    return () => {observer.disconnect();preference.removeEventListener('change',reduce);pendingCenter.current=null;};
  }, [selectedId, zoom]);
  const labels = zoneLabels(stalls);
  const statusLabels = mode === "public" ? { ...statuses, available: "ยังไม่มีร้าน", occupied: "มีร้านค้า" } : statuses;
  return <div className={styles.root} onKeyDown={(event) => { if (event.key === "Escape" && clusterKey) { event.stopPropagation(); closeChooser(); } }}>
    <div className={styles.toolbar} aria-label="ปรับมุมมองแผนผัง">
      <Button type="button" variant="outline" size="sm" disabled={zoom >= 2} onClick={() => changeZoom(Math.min(2, zoom + .25))}>ขยาย +</Button>
      <Button type="button" variant="outline" size="sm" disabled={zoom <= 1} onClick={() => changeZoom(Math.max(1, zoom - .25))}>ย่อ −</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => changeZoom(1,true)}>คืนมุมมอง</Button>
      <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
    </div>
    {cluster && <section ref={chooser} id={chooserId} className={styles.chooser} aria-labelledby={`${chooserId}-title`} data-map-cluster-chooser="" data-app-dialog-escape-layer="">
      <div className={styles.chooserHeading}><h3 id={`${chooserId}-title`}>ตำแหน่งนี้มี {cluster.stalls.length} ล็อก · เลือกดูล็อก</h3>
        <Button type="button" variant="ghost" size="sm" onClick={closeChooser}>ยกเลิก</Button></div>
      <div className={styles.chooserList}>{cluster.stalls.map((stall) => <Button key={stall.id} type="button" variant="outline" disabled={disabled}
        data-cluster-choice={stall.id} aria-pressed={selectedId === stall.id} aria-controls={controlsId}
        onClick={(event) => {
          // Return focus to the persistent map trigger, not a chooser button that disappears.
          const anchor = markers.current.get(stall.id) ?? event.currentTarget;
          setClusterKey(null); anchor.focus({ preventScroll: true }); onSelect(stall.id, anchor);
        }}>โซน {stall.zone} · {stall.code} · {statusLabels[stall.status]}</Button>)}</div>
    </section>}
    <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="ผังล็อกที่เลื่อนได้"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        zoomAnimation.current?.finish();zoomAnimation.current?.cancel();zooming.current=false;pendingCenter.current=null;
        // An intentional pan interrupts native search-focus scrolling immediately.
        event.currentTarget.scrollTo({left:event.currentTarget.scrollLeft,top:event.currentTarget.scrollTop,behavior:'instant'});
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = gesture.current;
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 7) return;
        drag.moved = true;
        suppressClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft = drag.left - dx;
        event.currentTarget.scrollTop = drag.top - dy;
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        gesture.current = null;
      }}
      onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
      onClickCapture={(event) => {
        // A drag must never choose a stall. Keyboard-generated clicks have detail 0.
        if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}>
      <div ref={stage} className={styles.stage} data-map-stage="" style={{ width: `${zoom * 100}%`, minWidth: minWidth * zoom }}>
        <MarketMapSurface name={name} layoutImage={layoutImage}>
          {labels.map((zone) => <span key={zone.name} className={styles.zone} style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%` }}>โซน {zone.name}</span>)}
          {groups.map((group) => {
            const selected = group.stalls.find((stall) => stall.id === selectedId);
            const stall = selected ?? group.stalls[0];
            const point = group.point;
            const multiple = group.stalls.length > 1;
            return <button key={group.key} type="button" className={styles.marker} disabled={disabled}
              data-map-stall={multiple ? undefined : ""} data-map-cluster={multiple ? group.stalls.length : undefined}
              data-stall-id={stall.id} data-status={stall.status} data-selected={!!selected}
              ref={(node) => { for (const row of group.stalls) { if (node) markers.current.set(row.id, node); else markers.current.delete(row.id); markerRef?.(row.id, node); } }}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              aria-pressed={selectedId === stall.id} aria-controls={multiple ? chooserId : controlsId}
              aria-expanded={multiple ? clusterKey === group.key : undefined}
              aria-label={multiple ? `ตำแหน่งร่วมกัน ${group.stalls.length} ล็อก: ${group.stalls.slice(0, 4).map((row) => row.code).join(", ")} กดเพื่อเลือกรายการล็อก` : `ล็อก ${stall.code} โซน ${stall.zone} ${selectedId === stall.id ? "เลือกอยู่ · " : ""}${statusLabels[stall.status]}${stall.detail ? ` · ${stall.detail}` : ""}`}
              onClick={(event) => {
                if (multiple) { clusterTrigger.current = event.currentTarget; setClusterKey(group.key); }
                else onSelect(stall.id, event.currentTarget);
              }}>
              <strong>{stall.code}</strong><span>{multiple ? `${group.stalls.length} ล็อก · แตะเลือก` : selectedId === stall.id ? "✓ เลือกอยู่" : statusLabels[stall.status]}</span>
            </button>;
          })}
          {!stalls.length && <p className={styles.empty}>ยังไม่มีล็อกในผังนี้</p>}
        </MarketMapSurface>
      </div>
    </div>
    <div className={styles.legend} aria-label="สถานะล็อก">
      {mode === "public" ? <><span data-status="available">ยังไม่ลงทะเบียน</span><span data-status="occupied">มีร้านค้า</span></> : <><span data-status="available">เลือกได้</span><span data-status="unavailable">ไม่ว่าง / ปิดใช้งาน</span><span data-status="own">ล็อกของคุณ</span></>}
      <span data-selected="true">✓ เลือกอยู่</span>
    </div>
    {entrance && <p className={styles.note}>ทางเข้า: {entrance}</p>}
  </div>;
}
