"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { evidenceKey, generateEvidence, useEvidence } from "@/lib/completion-evidence";
export function EvidenceButton({courseIds,lessonId}:{courseIds:string[];lessonId?:string}){
  const records=useEvidence();const e=records.find(x=>x.scopeKey===evidenceKey(courseIds,lessonId));const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
  if(e?.status==='ready'||e?.status==='generating')return <Link href={`/evidence/${e.id}`} className="btn btn-sm btn-ghost"><Sparkles size={16}/>{e.status==='ready'?'View completion evidence':'Evidence is being written…'}</Link>;
  return <div><button className="btn btn-sm btn-ghost" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const done=await generateEvidence(courseIds,lessonId);router.push(`/evidence/${done.id}`);}catch(err){setError(err instanceof Error?err.message:'Try again.');}finally{setBusy(false);}}}><Sparkles size={16}/>{busy?'Writing evidence…':'Generate completion evidence'}</button>{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
