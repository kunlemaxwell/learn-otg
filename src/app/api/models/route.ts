import { MODELS } from "@/lib/models";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Which models have a provider key configured on this server. */
export async function GET() {
  const mock = process.env.LEARN_OTG_MOCK === "1" || (!process.env.NVIDIA_API_KEY && !process.env.GROQ_API_KEY);
  return Response.json({
    available: Object.fromEntries(MODELS.map((m) => [m.id, mock || Boolean(getProvider(m.provider).apiKey)])),
  });
}
