"use client";
import { mockFlag } from "./mock-flag";
import { currentModel } from "./settings";

export type GradeResult = {
  verdict: "correct" | "partial" | "incorrect" | "unsure";
  score: number;
  feedback: string;
  seen?: string;
  model?: string;
};

export class GradeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Ask the tutor to mark a typed answer or a photo. */
export async function gradeAnswer(input: {
  kind: "text" | "image";
  question: string;
  modelAnswer?: string;
  lookFor?: string[];
  response?: string;
  image?: string;
  lesson?: string;
}): Promise<GradeResult> {
  const { model, params } = currentModel();
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, model: model.id, params, mock: mockFlag(), fast: currentModel().s.fastPlanning }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new GradeError(j.error ?? `Couldn't mark that (${res.status}).`, j.code);
  return j as GradeResult;
}

/** Shrink a photo to a JPEG data URL small enough to send. */
export async function downscaleImage(file: File, max = 1280): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
