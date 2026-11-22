import "server-only";
// Tiny JSON-file stores for the prototype: search cache, lesson cache and the
// saved component library. Files live in .learn-otg-data/ next to the app.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".learn-otg-data");

type Entry<T> = { value: T; expires: number };

class JsonStore<T> {
  private data: Record<string, Entry<T>> | null = null;
  private timer: NodeJS.Timeout | null = null;
  constructor(
    private file: string,
    private maxEntries: number,
  ) {}

  private load(): Record<string, Entry<T>> {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(readFileSync(path.join(DIR, this.file), "utf8"));
    } catch {
      this.data = {};
    }
    return this.data!;
  }

  private save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, this.file), JSON.stringify(this.data));
      } catch {
        // disk unavailable: keep working from memory
      }
    }, 300);
  }

  get(key: string): T | undefined {
    const e = this.load()[key];
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      delete this.load()[key];
      this.save();
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T, ttlMs: number) {
    const d = this.load();
    d[key] = { value, expires: Date.now() + ttlMs };
    const keys = Object.keys(d);
    if (keys.length > this.maxEntries) {
      keys
        .sort((a, b) => d[a].expires - d[b].expires)
        .slice(0, keys.length - this.maxEntries)
        .forEach((k) => delete d[k]);
    }
    this.save();
  }

  delete(key: string) {
    delete this.load()[key];
    this.save();
  }

  values(): T[] {
    const now = Date.now();
    return Object.values(this.load())
      .filter((e) => e.expires >= now)
      .map((e) => e.value);
  }

  clear() {
    this.data = {};
    this.save();
  }
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const g = globalThis as unknown as { __otgStores?: Record<string, JsonStore<unknown>> };
g.__otgStores ??= {};
function store<T>(name: string, max: number): JsonStore<T> {
  g.__otgStores![name] ??= new JsonStore<T>(`${name}.json`, max);
  return g.__otgStores![name] as JsonStore<T>;
}

export const searchCache = store<unknown>("search-cache", 500);
export const lessonCache = store<{
  text: string;
  tools: unknown[];
  usedSources: boolean;
  modelId: string;
  createdAt: number;
}>("lesson-cache", 300);
export const componentStore = store<SavedComponent>("components", 200);

export type SavedComponent = {
  id: string;
  label: string;
  kinds: string[];
  topic: string;
  keywords: string[];
  code: string;
  uses: number;
  createdAt: number;
  lastUsed: number;
};

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
