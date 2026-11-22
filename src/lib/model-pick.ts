import "server-only";
// Which model to use for a job, beyond the learner's chosen one.
// Measured on the free tiers (Oct 2026): a course outline took ~4 s on Qwen (Groq), ~40 s on GLM-5.3 (NVIDIA);
// a lesson page ~3 s on GPT-OSS (Groq), ~25 s on GLM-5.3.
import { getModel, type ModelDef, type ParamValues } from "./models";
import { getProvider } from "./providers";

export type Pick = { model: ModelDef; params: ParamValues | undefined; label: string };

const hasKey = (m: ModelDef) => Boolean(getProvider(m.provider).apiKey);

/** A fast model for short structured jobs (outlines, quizzes, marking). Null when there's no Groq key. */
export function fastModel(): Pick | null {
  const m = getModel("qwen/qwen3.8-27b");
  if (m.id !== "qwen/qwen3.8-27b" || !hasKey(m)) return null;
  return { model: m, params: { reasoning_effort: "none", temperature: 0.6, top_p: 1 }, label: m.name };
}

/** A different model to try when the chosen one keeps failing. */
export function backupModel(current: string): Pick | null {
  const cur = getModel(current);
  const candidates = cur.provider === "nvidia" ? ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"] : ["z-ai/glm-5.3", "openai/gpt-oss-120b"];
  for (const id of candidates) {
    const m = getModel(id);
    if (m.id === id && m.id !== cur.id && hasKey(m)) {
      const params: ParamValues = m.id === "openai/gpt-oss-120b" ? { reasoning_effort: "low", temperature: 0.6, top_p: 1 } : m.id === "z-ai/glm-5.3" ? { reasoning_effort: "off", temperature: 0.5 } : { reasoning_effort: "none", temperature: 0.6 };
      return { model: m, params, label: m.name };
    }
  }
  return null;
}
