"use client";
import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import styles from "./app-dialog.module.css";

// Freeze the last open body during Radix's exit, even when a caller clears its selection.
const RetainedDialogBody = memo(function RetainedDialogBody({children}: {open:boolean;children:React.ReactNode}) { return children; }, (_previous,next)=>!next.open);

const AppDialogCloseContext = createContext<(() => void) | null>(null);
export function useAppDialogClose() { return useContext(AppDialogCloseContext); }

/** One responsive focus trap, including discard confirmation: drafts never need nested dialogs. */
export function AppDialog({open,onOpenChange,title,description,dirty=false,busy=false,restoreFocusRef,wide=false,children}: {
  open:boolean; onOpenChange:(open:boolean)=>void; title:string; description?:string;
  dirty?:boolean; busy?:boolean; wide?:boolean; restoreFocusRef?:React.RefObject<HTMLElement | null>; children:React.ReactNode;
}) {
  const [discard, setDiscard] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const resume = useRef<HTMLButtonElement>(null);
  const formFocus = useRef<HTMLElement | null>(null);
  function close() {
    if (busy) return;
    if (dirty) { formFocus.current = document.activeElement as HTMLElement; setDiscard(true); }
    else onOpenChange(false);
  }
  useEffect(() => {
    if (discard) resume.current?.focus();
  }, [discard]);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[open,dirty]);
  return <Dialog open={open} onOpenChange={next=>{if(next){setDiscard(false);onOpenChange(true);}else close();}}>
    <DialogContent className={styles.surface} data-app-dialog data-wide={wide || undefined} showCloseButton={!busy}
      onOpenAutoFocus={()=>{opener.current=document.activeElement as HTMLElement;}}
      onCloseAutoFocus={event=>{event.preventDefault(); const target=restoreFocusRef?.current ?? opener.current; if(target?.isConnected)target.focus();}}
      onEscapeKeyDown={event=>{
        if(busy||discard){event.preventDefault();if(discard){setDiscard(false);requestAnimationFrame(()=>formFocus.current?.focus());}}
        // Radix listens on document before React bubbles: let an inner chooser
        // consume Escape without dismissing the enclosing dialog first.
        else if(event.target instanceof Element && event.target.closest("[data-app-dialog-escape-layer]")) event.preventDefault();
      }}
      onInteractOutside={event=>{if(busy||discard)event.preventDefault();}}>
      <RetainedDialogBody open={open}>
      <DialogHeader className={styles.header}>
        <DialogTitle>{discard ? "ละทิ้งการเปลี่ยนแปลง?" : title}</DialogTitle>
        <DialogDescription className={discard ? undefined : "sr-only"}>
          {discard ? "ข้อมูลที่ยังไม่ได้บันทึกจะไม่ถูกเก็บไว้" : description ?? "แก้ไขข้อมูลแล้วกดบันทึก หรือยกเลิกเพื่อกลับ"}
        </DialogDescription>
      </DialogHeader>
      <div className={styles.content} hidden={discard}><AppDialogCloseContext.Provider value={close}>{children}</AppDialogCloseContext.Provider></div>
      {discard && <div className={styles.discard}>
        <Button ref={resume} variant="outline" onClick={()=>{setDiscard(false);requestAnimationFrame(()=>formFocus.current?.focus());}}>แก้ไขต่อ</Button>
        <Button variant="destructive" onClick={()=>{setDiscard(false);onOpenChange(false);}}>ละทิ้งการเปลี่ยนแปลง</Button>
      </div>}
      </RetainedDialogBody>
    </DialogContent>
  </Dialog>;
}
