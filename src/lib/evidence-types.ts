import { z } from "zod";
export const evidenceSummarySchema = z.object({
  title:z.string().min(1).max(120), summary:z.string().min(1).max(900), skills:z.array(z.string().min(1).max(180)).min(1).max(6),
  lessons:z.array(z.object({title:z.string().max(100),takeaway:z.string().max(300)})).min(1).max(8),
  scenarios:z.array(z.object({title:z.string().max(100),description:z.string().max(350)})).max(4),
});
export type EvidenceSummary=z.infer<typeof evidenceSummarySchema>;
export type EvidenceSource={ titles:string[]; lessons:{title:string;summary:string;scenarios:string[];activities:{kind:string;question:string;correct?:boolean|null}[]}[] };
export type CompletionEvidence=EvidenceSummary & {
  id:string;scopeKey:string;courseIds:string[];lessonId?:string;learner:string;createdAt:number;
  status:"generating"|"ready"|"error";error?:string;
  counts:{courses:number;lessons:number;quizzes:number;passed:number;scenarios:number;activities:number};
  certificates:{title:string;code:string;issuedAt:number}[];model?:string;
};
