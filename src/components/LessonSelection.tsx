"use client";
import { ArrowLeft, BookOpen, Check, Copy, MessageCircle, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createNotebook, saveNote, useNotebooks } from "@/lib/notebooks";
import { ActionPopover, type MenuAnchor } from "./ActionPopover";
export function LessonSelection({children,title,onAsk}:{children:React.ReactNode;title:string;onAsk:(quote:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null); const books=useNotebooks(); const [quote,setQuote]=useState(""); const [anchor,setAnchor]=useState<MenuAnchor>();
  const [view,setView]=useState<"actions"|"books"|"new">("actions"); const [name,setName]=useState(""); const [saved,setSaved]=useState("");
  const dismiss=useCallback(()=>{setQuote("");window.getSelection()?.removeAllRanges();},[]);
  useEffect(()=>{
    const selected=()=>{ const s=window.getSelection(); if(!s?.rangeCount||!s.toString().trim()||!ref.current?.contains(s.anchorNode)||!ref.current.contains(s.focusNode))return;
      const rect=s.getRangeAt(0).getBoundingClientRect();setAnchor({left:rect.left,top:rect.top,bottom:rect.bottom,width:rect.width});setQuote(s.toString().trim().slice(0,20000));setView("actions");setSaved(""); };
    const pointer=(e:Event)=>{ if((e.target as Element)?.closest('.action-popover'))return;setTimeout(selected,0); };
    document.addEventListener('pointerup',pointer);document.addEventListener('keyup',pointer);document.addEventListener('copy',pointer);
    const node=ref.current;node?.addEventListener('contextmenu',pointer);
    return()=>{document.removeEventListener('pointerup',pointer);document.removeEventListener('keyup',pointer);document.removeEventListener('copy',pointer);node?.removeEventListener('contextmenu',pointer);};
  },[]);
  const save=(id:string)=>{saveNote(id,quote,title,window.location.pathname);setSaved(`Saved to ${books.find(b=>b.id===id)?.name??name.trim()}`);setView("actions");};
  return <div className="lesson-selectable" ref={ref}>{children}{quote&&anchor&&<ActionPopover anchor={anchor} label="Selected text actions" side="bottom" onClose={dismiss}>
    <div className="popover-heading"><span>{view==='actions'?'Selected text':view==='books'?'Save to notebook':'New notebook'}</span><button className="icon-btn" aria-label="Close selected text actions" onClick={dismiss}><X size={16}/></button></div>
    {saved?<div className="menu-status" role="status"><Check size={16}/> {saved}</div>:view==='actions'?<>
      <button className="menu-item" onClick={()=>{onAsk(quote);dismiss();}}><MessageCircle size={17}/>Ask Learn OTG</button>
      <button className="menu-item" onClick={async()=>{try{await navigator.clipboard.writeText(quote);setSaved('Copied');}catch{setSaved("Use your browser's Copy command.");}}}><Copy size={17}/>Copy</button>
      <button className="menu-item" onClick={()=>setView('books')}><BookOpen size={17}/>Save to notebook</button>
    </>:view==='books'?<>
      <div className="menu-list">{books.map(b=><button className="menu-item" key={b.id} onClick={()=>save(b.id)}><BookOpen size={17}/>{b.name}</button>)}</div>
      <button className="menu-item menu-divider" onClick={()=>setView('new')}><Plus size={17}/>New notebook</button>
    </>:<form onSubmit={e=>{e.preventDefault();const id=createNotebook(name);save(id);setName('');}}>
      <label className="menu-field"><span>Name</span><input autoFocus aria-label="Notebook name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="e.g. Product ideas"/></label>
      <div className="row spread"><button className="btn btn-sm btn-ghost" type="button" onClick={()=>setView('books')}><ArrowLeft size={16}/>Back</button><button className="btn btn-sm btn-primary" disabled={!name.trim()}>Create and save</button></div>
    </form>}
  </ActionPopover>}</div>;
}
