"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EvidencePage } from "@/components/EvidencePage";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { generateEvidence, useEvidence } from "@/lib/completion-evidence";
export default function EvidenceDetail(){const {id}=useParams<{id:string}>();const list=useEvidence();const e=list.find(e=>e.id===id);const mounted=useMounted();return <><PageHeader title="Completion evidence" actions={<Link className="btn btn-sm btn-ghost" href="/evidence">All evidence</Link>}/><main className="page-body evidence-body">{!mounted?null:!e?<p>This learning record is not on this device.</p>:e.status==='ready'?<EvidencePage evidence={e}/>:<section className="card" role={e.status==='error'?'alert':'status'}><h2>{e.status==='generating'?'Writing your learning record…':'Evidence could not be generated'}</h2><p>{e.error||'Summarizing your lessons, practice and completion.'}</p>{e.status==='error'&&<button className="btn" onClick={()=>void generateEvidence(e.courseIds,e.lessonId,true).catch(()=>{})}>Try again</button>}</section>}</main></>;}
