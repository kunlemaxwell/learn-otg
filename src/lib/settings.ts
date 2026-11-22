"use client";
import { useSyncExternalStore } from "react";
import { DEFAULT_COURSE_OPTIONS, type CourseOptions } from "./course-types";
import { DEFAULT_MODEL_ID, defaultParams, getModel, sanitizeParams, type ParamValues } from "./models";

export type AppSettings = {
  modelId: string; // the default model, chosen on the Model settings page
  params: Record<string, ParamValues>; // per model id
  showThinking: boolean;
  browsing: boolean;
  componentMode: "auto" | "reuse" | "off";
  showStats: boolean;
  instantAnswer: boolean;
  courseDefaults: CourseOptions; // applied to every new course unless changed while creating it
  memory: boolean; // remember what the learner studies and use it in later lessons
  autoSuggest: boolean; // suggest what to learn next from memory and progress
  inspector: boolean; // OpenUI Inspect widget (development only)
  fastPlanning: boolean; // outlines, quizzes and marking use the fast Groq model when available
  evidenceMode: "manual" | "auto";
  backupModel: boolean; // recover stalled lessons/planning and repeatedly failed pages with another provider
};

const KEY = "learn-otg:settings:v5";
const OLD_KEYS = ["learn-otg:settings:v4", "learn-otg:settings:v3"];
const SERVER_SNAPSHOT: AppSettings = {
  modelId: DEFAULT_MODEL_ID,
  params: {},
  showThinking: true,
  browsing: true,
  componentMode: "auto",
  showStats: false,
  instantAnswer: true,
  courseDefaults: DEFAULT_COURSE_OPTIONS,
  memory: true,
  autoSuggest: true,
  inspector: false,
  fastPlanning: true,
  backupModel: true,
  evidenceMode: "manual",
};

let cache: AppSettings | null = null;
const listeners = new Set<() => void>();

function load(): AppSettings {
  try {
    let raw = window.localStorage.getItem(KEY);
    for (const k of OLD_KEYS) raw ??= window.localStorage.getItem(k);
    if (!raw) return SERVER_SNAPSHOT;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...SERVER_SNAPSHOT,
      ...parsed,
      params: parsed.params ?? {},
      courseDefaults: { ...DEFAULT_COURSE_OPTIONS, ...(parsed.courseDefaults ?? {}) },
    };
  } catch {
    return SERVER_SNAPSHOT;
  }
}

function getSnapshot(): AppSettings {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (!cache) cache = load();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function write(next: AppSettings) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode); settings stay for this session
  }
  listeners.forEach((l) => l());
}

export const readSettings = getSnapshot;
export const patchSettings = (patch: Partial<AppSettings>) => write({ ...getSnapshot(), ...patch });

/** The model and parameters to use right now. */
export function currentModel() {
  const s = getSnapshot();
  const model = getModel(s.modelId);
  const params = sanitizeParams(model, { ...defaultParams(model), ...s.params[model.id] });
  return { s, model, params };
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const model = getModel(settings.modelId);
  const params = sanitizeParams(model, { ...defaultParams(model), ...settings.params[model.id] });
  return { settings, update: write, model, params };
}
