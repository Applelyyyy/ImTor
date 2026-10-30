"use client";
import {useCallback,useState} from "react";
import {AppDialog} from "@/components/app-dialog";
import {ApiForm} from "@/components/forms";
import {Button} from "@/components/ui/button";
export function ContextualForm({title,label,description,...props}:React.ComponentProps<typeof ApiForm>&{title:string;label:string;description?:string}) {
 const [open,setOpen]=useState(false);
 const [state,setState]=useState({dirty:false,busy:false});
 const onStateChange=useCallback((next:{dirty:boolean;busy:boolean})=>setState(next),[]);
 return <><Button variant="outline" onClick={()=>setOpen(true)}>{label}</Button>
  <AppDialog open={open} onOpenChange={setOpen} title={title} description={description} {...state}>
   {open && <ApiForm {...props} onStateChange={onStateChange} onCancel={()=>setOpen(false)} onSaved={()=>setOpen(false)}/>}
  </AppDialog>
 </>;
}
