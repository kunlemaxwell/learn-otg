"use client";
import { FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { readChatAttachment, type ChatAttachment } from "@/lib/chat-attachments";
export function AttachmentButton({files,onChange,disabled,onReading}:{files:ChatAttachment[];onChange:(files:ChatAttachment[])=>void;disabled?:boolean;onReading?:(reading:boolean)=>void}) {
  const input=useRef<HTMLInputElement>(null);const [reading,setReading]=useState(false);const [error,setError]=useState('');
  return <><button className="icon-btn" type="button" aria-label="Attach files" title="Attach documents or images" disabled={disabled||reading} onClick={()=>input.current?.click()}>{reading?<LoaderCircle size={18} className="spin"/>:<Paperclip size={18}/>}</button>
    <input ref={input} type="file" multiple hidden onChange={async e=>{const selected=Array.from(e.target.files??[]);e.target.value='';setReading(true);onReading?.(true);setError('');let next=[...files];const errors:string[]=[];
      for(const file of selected){try{if(next.length>=4)throw new Error('Attach up to four files at a time.');const item=await readChatAttachment(file);if(item.image&&next.some(f=>f.image))throw new Error('Attach one image at a time. Documents can be added alongside it.');next=[...next,item];}catch(err){errors.push(err instanceof Error?err.message:'This file could not be read.');}}
      onChange(next);setReading(false);onReading?.(false);setError(errors.join(' '));}}/>
    {error&&<span className="attachment-error" role="alert">{error}</span>}
  </>;
}
export function AttachmentList({files,onRemove}:{files:ChatAttachment[];onRemove?:(index:number)=>void}) {
  if(!files.length)return null;
  return <div className="chat-attachments">{files.map((f,i)=><span className="attachment-chip" key={`${f.name}-${i}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {f.image?<img src={f.image} alt=""/>:<FileText size={15}/>}<span title={f.name}>{f.name}</span>{onRemove&&<button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={()=>onRemove(i)}><X size={13}/></button>}
  </span>)}</div>;
}
