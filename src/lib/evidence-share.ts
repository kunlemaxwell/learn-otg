"use client";
import { z } from "zod";
import { evidenceSummarySchema, type CompletionEvidence } from "./evidence-types";
const publicSchema=evidenceSummarySchema.extend({id:z.string().max(80),scopeKey:z.string().max(1000),courseIds:z.array(z.string().max(80)).max(12),lessonId:z.string().max(80).optional(),learner:z.string().max(200),createdAt:z.number().finite().positive(),status:z.literal('ready'),counts:z.object({courses:z.number().int().min(0).max(10000),lessons:z.number().int().min(0).max(10000),quizzes:z.number().int().min(0).max(10000),passed:z.number().int().min(0).max(10000),scenarios:z.number().int().min(0).max(10000),activities:z.number().int().min(0).max(10000)}),certificates:z.array(z.object({title:z.string().max(160),code:z.string().max(80),issuedAt:z.number().finite().positive()})).max(12)});
export async function evidenceShareUrl(record:CompletionEvidence){
  const snapshot=publicSchema.parse(record);const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
  const packed=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const encoded=btoa(Array.from(packed,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${window.location.origin}/evidence/shared#v1=${encoded}`;
}
export async function decodeEvidenceLink(hash:string):Promise<CompletionEvidence>{
  const encoded=hash.replace(/^#v1=/,'');if(!hash.startsWith('#v1=')||encoded.length>50000)throw new Error('This evidence link is incomplete or too large.');
  const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>80000){await reader.cancel();throw new Error('This evidence link is too large.');}chunks.push(value);}
  const combined=new Uint8Array(size);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}const text=new TextDecoder().decode(combined);return publicSchema.parse(JSON.parse(text));
}
