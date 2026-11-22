#!/usr/bin/env node
// Learn OTG guided setup. Run with:  node scripts/setup.mjs   (or: npm run setup)
// Uses only Node's built-in modules, so it works before `npm install`.
// 1. Checks Node.js  2. Installs packages  3. Helps you add free API keys (optional)  4. Starts the app
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const rl = createInterface({ input, output });
const ask = async (q, def = "") => ((await rl.question(q)).trim() || def);
const yes = async (q, def = true) => {
  const a = (await ask(`${q} ${def ? "[Y/n]" : "[y/N]"} `)).toLowerCase();
  return a ? a.startsWith("y") : def;
};
const say = (s = "") => console.log(s);
const title = (s) => say(`\n\x1b[1m${s}\x1b[0m`);

say("\n\x1b[1mLearn OTG setup\x1b[0m: learning on the go. This takes a few minutes.");

// 1. Node.js
title("1. Checking Node.js");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  say(`You have Node.js ${process.versions.node}. Learn OTG needs version 20 or newer.`);
  say("Install the LTS version from https://nodejs.org (or run: nvm install --lts), then run this setup again.");
  process.exit(1);
}
say(`Node.js ${process.versions.node}: good.`);

// 2. Packages
title("2. Installing packages");
if (existsSync("node_modules") && !(await yes("Packages are already installed. Reinstall them?", false))) {
  say("Keeping the installed packages.");
} else {
  say("Running npm install (this can take a minute or two)...");
  try {
    execSync("npm install --no-audit --no-fund", { stdio: "inherit" });
  } catch {
    say("\nnpm install failed. Check your internet connection and run this setup again.");
    process.exit(1);
  }
}

// 3. Keys
title("3. AI models (optional, free)");
say("Learn OTG works with no keys at all, in demo mode (sample lessons, no AI calls).");
say("For real lessons, add one or both free keys. Groq is the fastest; NVIDIA has the strongest free models.");
const envPath = ".env.local";
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  say(`Found your existing ${envPath}. Press Enter at any question to keep what is there.`);
}

if (await yes("\nAdd a free Groq key now?", !env.GROQ_API_KEY)) {
  say("  1. Open https://console.groq.com and sign in (Google or GitHub works).");
  say("  2. Go to API Keys: https://console.groq.com/keys");
  say("  3. Click Create API Key, give it any name, and copy it (it starts with gsk_).");
  const k = await ask("  Paste your Groq key (or press Enter to skip): ", env.GROQ_API_KEY || "");
  if (k && !k.startsWith("gsk_")) say("  That does not look like a Groq key (gsk_...), but I saved it anyway.");
  env.GROQ_API_KEY = k;
}

if (await yes("\nAdd a free NVIDIA key now?", !env.NVIDIA_API_KEY)) {
  say("  1. Open https://build.nvidia.com and sign in or create a free account.");
  say("  2. Open any model page (for example search for GLM or Kimi).");
  say("  3. Click Get API Key, then Generate Key, and copy it (it starts with nvapi-).");
  say("  Tip: if a model later says 403, open that model's page and click Try API once.");
  const k = await ask("  Paste your NVIDIA key (or press Enter to skip): ", env.NVIDIA_API_KEY || "");
  if (k && !k.startsWith("nvapi-")) say("  That does not look like an NVIDIA key (nvapi-...), but I saved it anyway.");
  env.NVIDIA_API_KEY = k;
}

if (await yes("\nAdd a web search key for better sources? (Tavily, free tier; most people skip this)", false)) {
  say("  Get one at https://tavily.com (free tier). Without it the app uses DuckDuckGo and Wikipedia.");
  env.TAVILY_API_KEY = await ask("  Paste your Tavily key (or press Enter to skip): ", env.TAVILY_API_KEY || "");
}

const file = `# Learn OTG settings, written by scripts/setup.mjs. Never share or commit this file.
# Server-side only: these are never sent to the browser.
NVIDIA_API_KEY=${env.NVIDIA_API_KEY || ""}
NVIDIA_BASE_URL=${env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}
GROQ_API_KEY=${env.GROQ_API_KEY || ""}
GROQ_BASE_URL=${env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}
TAVILY_API_KEY=${env.TAVILY_API_KEY || ""}
BRAVE_SEARCH_API_KEY=${env.BRAVE_SEARCH_API_KEY || ""}
# 1 = demo mode even with keys
LEARN_OTG_MOCK=${env.LEARN_OTG_MOCK || ""}
`;
writeFileSync(envPath, file, { mode: 0o600 });
const hasKey = Boolean(env.NVIDIA_API_KEY || env.GROQ_API_KEY);
say(`\nSaved ${envPath}. ${hasKey ? "Real AI lessons are on." : "No keys yet, so the app will run in demo mode. Run this setup again any time to add keys."}`);
if (env.GROQ_API_KEY && !env.NVIDIA_API_KEY) say("Tip: in the app, open Settings and choose a Groq model (Qwen) as your default.");

// 4. Start
title("4. Start");
const go = await yes("Start Learn OTG now?", true);
rl.close();
if (!go) {
  say("\nWhenever you are ready, run:  npm run dev   then open http://localhost:3000");
  process.exit(0);
}
say("Starting on http://localhost:3000 (press Ctrl+C to stop)...\n");
spawn("npm", ["run", "dev"], { stdio: "inherit", shell: process.platform === "win32" });
