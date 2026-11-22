"use client";
import { createStore, uid } from "./local-store";
import { allLessons, getCourse, isComplete, lessonPages } from "./courses";
import { readProfile, callName } from "./profile";
import { currentModel } from "./settings";
import { mockFlag } from "./mock-flag";
import { lessonGist } from "./learner-memory";
import { notify } from "./notifications";
import { evidenceSummarySchema, type CompletionEvidence, type EvidenceSource } from "./evidence-types";
import type { Course } from "./course-types";
const store=createStore<CompletionEvidence[]>("learn-otg:evidence:v1",[],raw=>Array.isArray(raw)?(raw as CompletionEvidence[]).map(x=>x.status==='generating'?{...x,status:'error',error:'Generation was interrupted. Try again.'}:x):[]);
export const useEvidence=()=>store.useValue();
export const readEvidence=()=>store.get();
export const evidenceKey=(ids:string[],lessonId?:string)=>`${lessonId?'lesson':'course'}:${[...ids].sort().join(',')}${lessonId?':'+lessonId:''}`;
let generationQueue: Promise<unknown> = Promise.resolve();
const running=new Map<string,Promise<CompletionEvidence>>();
export function evidenceSource(courses:Course[],lessonId?:string):EvidenceSource {
  return {titles:lessonId?[allLessons(courses[0]).find(x=>x.lesson.id===lessonId)?.lesson.title??courses[0].title]:courses.map(c=>c.title),lessons:courses.flatMap(c=>allLessons(c).filter(x=>x.lesson.done&&(!lessonId||x.lesson.id===lessonId)).map(({lesson})=>({
    title:lesson.title,summary:[lesson.summary,...lessonPages(lesson,c.options).filter(p=>p.status==="ready").map(p=>lessonGist(p.code??""))].filter(Boolean).join(" ").slice(0,600),scenarios:lessonPages(lesson,c.options).flatMap(p=>[...(p.code??'').matchAll(/\bScenario\("([^"\n]+)"/g)].map(m=>m[1])).slice(0,12),
    activities:lessonPages(lesson,c.options).flatMap(p=>p.answers??[]).slice(0,30).map(a=>({kind:a.kind,question:a.question.slice(0,250),correct:a.correct})),
  }))).slice(0,80)};
}
export function generateEvidence(ids:string[],lessonId?:string,force=false):Promise<CompletionEvidence>{
  const key=evidenceKey(ids,lessonId);if(running.has(key))return running.get(key)!;
  const existing=store.get().find(e=>e.scopeKey===key);if(existing?.status==='ready'&&!force)return Promise.resolve(existing);
  const task=generationQueue.catch(()=>{}).then(async()=>{
    const courses=ids.map(getCourse).filter((c):c is Course=>!!c);
    if(!courses.length||courses.length!==ids.length||courses.length>12)throw new Error('Choose up to twelve courses.');
    if(lessonId?!allLessons(courses[0]).some(x=>x.lesson.id===lessonId&&x.lesson.done):courses.some(c=>!isComplete(c)))throw new Error('Finish the selected learning before generating evidence.');
    const source=evidenceSource(courses,lessonId);const answers=courses.flatMap(c=>allLessons(c).filter(x=>x.lesson.done&&(!lessonId||x.lesson.id===lessonId)).flatMap(x=>lessonPages(x.lesson,c.options).flatMap(p=>p.answers??[])));
    const quizzes=courses.flatMap(c=>c.quizzes.filter(q=>q.attempts>0&&(!lessonId||q.lessonId===lessonId)));
    const profile=readProfile();const record:CompletionEvidence={id:existing?.id??uid(),scopeKey:key,courseIds:ids,lessonId,learner:profile.fullName||callName(profile)||'Learner',createdAt:Date.now(),status:'generating',title:lessonId?source.lessons[0].title:courses.map(c=>c.title).join(' · '),summary:'',skills:[],lessons:[],scenarios:[],counts:{courses:lessonId?0:courses.length,lessons:courses.reduce((total,c)=>total+allLessons(c).filter(x=>x.lesson.done&&(!lessonId||x.lesson.id===lessonId)).length,0),quizzes:quizzes.length+answers.filter(a=>a.kind==='choice').length,passed:quizzes.filter(q=>(q.score??0)>=.5).length+answers.filter(a=>a.kind==='choice'&&a.correct).length,scenarios:answers.filter(a=>a.kind==='scenario').length,activities:answers.filter(a=>a.kind!=='guess'&&a.kind!=='simulation').length},certificates:[]};
    try{const earned=JSON.parse(localStorage.getItem('learn-otg:earned:v1')??'[]') as {courseId:string;courseTitle:string;code:string;issuedAt:number}[];record.certificates=lessonId?[]:earned.filter(e=>ids.includes(e.courseId)).map(e=>({title:e.courseTitle,code:e.code,issuedAt:e.issuedAt}));}catch{}
    const save=(e:CompletionEvidence)=>store.set([e,...store.get().filter(x=>x.scopeKey!==key)]);
    save(record);
    try{const {model,params}=currentModel();const res=await fetch('/api/evidence',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(100000),body:JSON.stringify({source,model:model.id,params,mock:mockFlag()})});const j=await res.json();if(!res.ok)throw new Error(j.error||'Could not generate evidence.');const summary=evidenceSummarySchema.parse(j.summary);const done={...record,...summary,status:'ready' as const,model:j.model};save(done);notify({id:`evidence-${done.id}-${done.createdAt}`,title:'Completion evidence is ready',detail:done.title,href:`/evidence/${done.id}`});return done;
    }catch(e){save({...record,status:'error',error:e instanceof Error?e.message:'Generation failed.'});throw e;}
  });generationQueue=task;running.set(key,task);void task.finally(()=>running.delete(key)).catch(()=>{});return task;
}
