// Model registry for Learn OTG. Parameters and ranges mirror what each
// provider documents for that model (NVIDIA: docs.api.nvidia.com/nim/reference,
// Groq: console.groq.com/docs). Only parameters listed here are ever sent.

export type ProviderId = "nvidia" | "groq";

export type ParamDef =
  | {
      key: string;
      label: string;
      kind: "slider";
      min: number;
      max: number;
      step: number;
      vendorDefault: number;
      appDefault: number;
      help: string;
    }
  | {
      key: string;
      label: string;
      kind: "int";
      min: number;
      max: number;
      vendorDefault: number | null;
      appDefault: number;
      help: string;
    }
  | {
      key: string;
      label: string;
      kind: "select";
      options: string[];
      vendorDefault: string;
      appDefault: string;
      help: string;
    };

export type ModelDef = {
  id: string;
  name: string;
  vendor: string;
  provider: ProviderId;
  providerName: string;
  /** Short labels shown on the picker. */
  badges: ("Accurate" | "Fast" | "Fastest" | "Vision" | "Experimental")[];
  blurb: string;
  /** Plain-language reliability note from independent benchmarks. */
  reliability: string;
  supportsImages: boolean;
  /** Accepts OpenAI-style `tools`. */
  supportsTools: boolean;
  /** Send reasoning_content back on assistant tool-call turns (Kimi expects it). */
  echoReasoning: boolean;
  /** Always look up sources for new questions (for models that hallucinate more from memory). */
  groundAlways: boolean;
  /** Tight token budgets (free Groq: 8K tokens/minute) — keep context and sources small. */
  lean: boolean;
  /** Ask the provider for token usage in the stream. */
  streamUsage: boolean;
  /**
   * reasoning_effort "off" maps to chat_template_kwargs.enable_thinking=false. Leave unset for GLM-5.3 on NVIDIA:
   * tested Oct 2026, that switch made it think for minutes (4,096 tokens, no answer), while "low" gave no thinking at all.
   */
  thinkingSwitch?: boolean;
  /** Fixed request fields the app always sends for this model. */
  fixed?: Record<string, unknown>;
  params: ParamDef[];
};

const temperature = (vendorDefault: number, appDefault: number, max = 1, help?: string): ParamDef => ({
  key: "temperature",
  label: "Temperature",
  kind: "slider",
  min: 0,
  max,
  step: 0.05,
  vendorDefault,
  appDefault,
  help: help ?? "Higher gives more varied wording. Lower is more consistent. Change temperature or top-p, not both.",
});

const topP = (vendorDefault = 1): ParamDef => ({
  key: "top_p",
  label: "Top-p",
  kind: "slider",
  min: 0,
  max: 1,
  step: 0.05,
  vendorDefault,
  appDefault: 1,
  help: "Limits sampling to the most likely tokens. Leave at 1 if you tune temperature.",
});

const maxTokens = (key: string, max: number, vendorDefault: number | null, appDefault: number): ParamDef => ({
  key,
  label: "Max output tokens",
  kind: "int",
  min: 256,
  max,
  vendorDefault,
  appDefault,
  help: "Hard cap on answer length, including thinking. Lessons need about 1,500 tokens.",
});

const seed = (vendorDefault: number | null = null): ParamDef => ({
  key: "seed",
  label: "Seed",
  kind: "int",
  min: 0,
  max: 2147483647,
  vendorDefault,
  appDefault: 0,
  help: "Same seed and settings gives more repeatable answers.",
});

const effort = (options: string[], vendorDefault: string, appDefault: string): ParamDef => ({
  key: "reasoning_effort",
  label: "Reasoning effort",
  kind: "select",
  options,
  vendorDefault,
  appDefault,
  help: "How long the model thinks before answering. Low is much faster; with web sources it rarely needs more.",
});

export const MODELS: ModelDef[] = [
  {
    id: "z-ai/glm-5.3",
    name: "GLM-5.3",
    vendor: "Z.ai",
    provider: "nvidia",
    providerName: "NVIDIA",
    badges: ["Accurate"],
    blurb: "Best free all-rounder: strong tool use and the most reliable of the free models. Text only.",
    reliability: "Makes up an answer about 30% of the time when unsure — the lowest of the free options.",
    supportsImages: false,
    supportsTools: true,
    echoReasoning: false,
    groundAlways: false,
    lean: false,
    streamUsage: true,
    params: [
      temperature(0.5, 0.5),
      topP(),
      maxTokens("max_tokens", 65536, 1024, 4096),
      {
        key: "frequency_penalty",
        label: "Frequency penalty",
        kind: "slider",
        min: -2,
        max: 2,
        step: 0.1,
        vendorDefault: 0,
        appDefault: 0,
        help: "Positive values discourage repeating the same words.",
      },
      {
        key: "presence_penalty",
        label: "Presence penalty",
        kind: "slider",
        min: -2,
        max: 2,
        step: 0.1,
        vendorDefault: 0,
        appDefault: 0,
        help: "Positive values push the model toward new topics.",
      },
      seed(0),
      {
        ...effort(["off", "low", "high", "max"], "max", "off"),
        help: "Off uses the lowest supported effort. High and max think longer and can take minutes on the free tier.",
      } as ParamDef,
    ],
  },
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    vendor: "Alibaba",
    provider: "groq",
    providerName: "Groq",
    badges: ["Fast", "Vision"],
    blurb: "About 10× faster than GLM on Groq, reads images, calls tools. Always checks the web for facts.",
    reliability: "Close to GLM on science, weaker on tool use. Grounded with sources on every new question. Preview model.",
    supportsImages: true,
    supportsTools: true,
    echoReasoning: false,
    groundAlways: true,
    lean: true,
    streamUsage: false,
    fixed: { reasoning_format: "parsed" },
    params: [
      temperature(1, 0.6, 2, "Groq recommends 0.5–0.7 for reasoning models."),
      topP(),
      maxTokens("max_completion_tokens", 16384, 1024, 3000),
      seed(),
      effort(["none", "low", "medium", "high"], "default", "low"),
    ],
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    vendor: "Moonshot AI",
    provider: "nvidia",
    providerName: "NVIDIA",
    badges: ["Vision"],
    blurb: "Knows a lot and reads photos, diagrams and homework. Slower.",
    reliability: "Guesses about 53% of the time when unsure, so it always gets web sources for new questions.",
    supportsImages: true,
    supportsTools: true,
    echoReasoning: true,
    groundAlways: true,
    lean: false,
    streamUsage: true,
    params: [
      temperature(1, 1, 1, "Moonshot recommends 1.0 for Kimi K3. Other sampling settings are fixed by the model."),
      maxTokens("max_tokens", 65536, null, 4096),
      seed(),
      effort(["low", "high", "max"], "max", "low"),
    ],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    vendor: "OpenAI",
    provider: "groq",
    providerName: "Groq",
    badges: ["Fastest", "Experimental"],
    blurb: "Very fast and cheap. Use for quick tests only.",
    reliability: "Makes up answers about 91% of the time when unsure. Always grounded with sources, but treat with caution.",
    supportsImages: false,
    supportsTools: true,
    echoReasoning: false,
    groundAlways: true,
    lean: true,
    streamUsage: false,
    params: [
      temperature(1, 0.6, 2),
      topP(),
      maxTokens("max_completion_tokens", 65536, 1024, 3000),
      seed(),
      effort(["low", "medium", "high"], "medium", "low"),
    ],
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export type ParamValues = Record<string, number | string>;

export function defaultParams(model: ModelDef): ParamValues {
  return Object.fromEntries(model.params.map((p) => [p.key, p.appDefault]));
}

/** Clamp and filter user-supplied values to what the model accepts. */
export function sanitizeParams(model: ModelDef, input: ParamValues | undefined): ParamValues {
  const out: ParamValues = {};
  for (const p of model.params) {
    const raw = input?.[p.key];
    if (p.kind === "select") {
      out[p.key] = typeof raw === "string" && p.options.includes(raw) ? raw : p.appDefault;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      const v = Number.isFinite(n) ? n : p.appDefault;
      const clamped = Math.min(p.max, Math.max(p.min, v));
      out[p.key] = p.kind === "int" ? Math.round(clamped) : clamped;
    }
  }
  return out;
}
