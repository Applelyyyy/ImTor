"use client";
import {useEffect,useLayoutEffect,useRef,type CSSProperties} from "react";
import {animateMotion,motionMs,springFrames} from "@/lib/motion";
import { NavigationLink } from "@/components/pending-controls";

export function MarketSwitcher({
  types,
  active = "",
  week = 0,
}: {
  types: string[];
  active?: string;
  week?: number;
}) {
  const indicator=useRef<HTMLSpanElement>(null), nav=useRef<HTMLElement>(null);
  const position=useRef<{left:number;width:number}|null>(null), running=useRef<Animation|null>(null);
  useLayoutEffect(()=>{
    const node=indicator.current;if(!node)return;
    let previous=position.current;
    if(previous && running.current?.playState==='running') {
      const matrix=new DOMMatrix(getComputedStyle(node).transform);
      previous={left:previous.left+matrix.e,width:previous.width*matrix.a};
    }
    running.current?.cancel();
    const target=node.getBoundingClientRect();position.current={left:target.left,width:target.width};
    if(previous && target.width && Math.abs(previous.left-target.left)+Math.abs(previous.width-target.width)>.5)
      running.current=animateMotion(node,springFrames({x:previous.left-target.left,scaleX:previous.width/target.width}),motionMs(node,'--motion-spring',300),'linear');
  },[active,types.length]);
  useEffect(()=>{
    const element=nav.current;if(!element)return;
    let width=element.clientWidth;
    const observer=new ResizeObserver(()=>{
      if(element.clientWidth===width)return;width=element.clientWidth;running.current?.cancel();
      const rect=indicator.current?.getBoundingClientRect();if(rect)position.current={left:rect.left,width:rect.width};
    });
    observer.observe(element);return()=>{observer.disconnect();running.current?.cancel();};
  },[]);
  const choices = ["", ...types];
  const index = Math.max(0, choices.indexOf(active));
  const labels: Record<string, string> = {
    "": "ทุกตลาด",
    SMALL: "ตลาดเล็ก",
    LARGE: "ตลาดใหญ่",
  };
  return (
    <nav
      ref={nav}
      className="market-switcher"
      aria-label="ประเภทตลาด"
      style={
        {
          "--market-count": choices.length,
          "--market-index": index,
        } as CSSProperties
      }
    >
      <span ref={indicator} className="market-switcher-indicator" aria-hidden="true" />
      {choices.map((type) => (
        <NavigationLink
          key={type}
          href={
            "/markets?" +
            new URLSearchParams({ week: String(week), ...(type && { type }) })
          }
          aria-current={choices[index] === type ? "page" : undefined}
          scroll={false}
        >
          {labels[type] || type}
        </NavigationLink>
      ))}
    </nav>
  );
}
