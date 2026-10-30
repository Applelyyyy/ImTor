'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {animateMotion,motionMs} from '@/lib/motion';
/** Only confirmed value changes receive feedback; mounting and unchanged refreshes stay quiet. */
export function ChangeFeedback({value,children,className}: {value:string|number|null;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLSpanElement>(null),previous=useRef(value);
  useEffect(()=>{
    const element=ref.current;
    const changed=previous.current !== value;
    previous.current=value;
    if(!element || !changed)return;
    const animation=animateMotion(element,[{opacity:.45,transform:'translateY(3px)'},{opacity:1,transform:'none'}],motionMs(element,'--motion-feedback',200));
    return ()=>animation?.cancel();
  },[value]);
  return <span ref={ref} className={['change-feedback',className].filter(Boolean).join(' ')}>{children}</span>;
}
