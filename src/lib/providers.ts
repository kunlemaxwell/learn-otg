import "server-only";
import type { ProviderId } from "./models";

export type ProviderConfig = { id: ProviderId; name: string; baseUrl: string; apiKey?: string };

export function getProvider(id: ProviderId): ProviderConfig {
  if (id === "groq") {
    return {
      id,
      name: "Groq",
      baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    };
  }
  return {
    id: "nvidia",
    name: "NVIDIA",
    baseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
  };
}

export function providerKeyName(id: ProviderId): string {
  return id === "groq" ? "GROQ_API_KEY" : "NVIDIA_API_KEY";
}
