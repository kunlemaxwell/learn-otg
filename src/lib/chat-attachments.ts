"use client";
import { downscaleImage } from "./grade-client";
import { extractFiles } from "./course-gen";
export type ChatAttachment = { name: string; text?: string; image?: string };
export async function readChatAttachment(file: File): Promise<ChatAttachment> {
  if(file.size>15*1024*1024)throw new Error(`${file.name} is larger than 15 MB.`);
  if(file.type.startsWith('image/'))return {name:file.name,image:await downscaleImage(file)};
  const extracted=await extractFiles([file]); const text=extracted.filter(x=>x.text).map(x=>x.text).join('\n\n');
  if(!text.trim())throw new Error(`${file.name}: ${extracted[0]?.note||'No readable text was found. Try a document, image or text file.'}`);
  return {name:file.name,text:text.slice(0,12000)};
}
export function attachmentContext(files?: ChatAttachment[]) { return (files??[]).filter(f=>f.text).map(f=>`Attached document: ${f.name}\n${f.text}`).join('\n\n').slice(0,24000); }
