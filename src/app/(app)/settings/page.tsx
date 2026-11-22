"use client";

import { Brain, Check, Cpu, Download, GraduationCap, HardDrive, Layers, Monitor, Moon, Palette, RotateCcw, Sliders, Sparkles, Sun, Trash2, User, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CourseOptionsForm } from "@/components/CourseOptionsForm";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { AreaPicker, StylePicker } from "@/components/shell/Onboarding";
import { clearHistory } from "@/lib/history";
import { forgetAll, useMemory } from "@/lib/learner-memory";
import { defaultParams, MODELS, type ParamDef } from "@/lib/models";
import { saveProfile, useProfile } from "@/lib/profile";
import { useSettings, type AppSettings } from "@/lib/settings";
import { useTheme, type ThemePref } from "@/lib/theme";

type SavedComponent = { id: string; label: string; topic: string; uses: number; kinds: string[] };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "style", label: "Learning style", icon: Sparkles },
  { id: "courses", label: "Course defaults", icon: GraduationCap },
  { id: "model", label: "AI model", icon: Cpu },
  { id: "memory", label: "Memory & suggestions", icon: Brain },
  { id: "lessons", label: "Lessons & chat", icon: Sliders },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Wrench },
  { id: "data", label: "Your data", icon: HardDrive },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const MODES: { id: AppSettings["componentMode"]; label: string; help: string }[] = [
  { id: "auto", label: "Auto-save", help: "Save good layouts and reuse them. Fastest and most consistent." },
  { id: "reuse", label: "Reuse only", help: "Reuse saved layouts but don't save new ones." },
  { id: "off", label: "Reinvent", help: "Build every layout from scratch. Most creative, slower." },
];

const fmt = (n: number, step: number) => (step >= 1 ? String(Math.round(n)) : n.toFixed(step < 0.1 ? 2 : 1));
const vendorLabel = (p: ParamDef, provider: string) => (p.vendorDefault === null ? `${provider} default: not set` : `${provider} default: ${p.vendorDefault}`);

function Toggle({ label, help, checked, onChange, disabled }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

function storageUse(): { kb: number; parts: { label: string; kb: number }[] } {
  const parts: Record<string, number> = {};
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith("learn-otg:")) continue;
      const size = (localStorage.getItem(k)?.length ?? 0) * 2;
      total += size;
      const label = /courses/.test(k) ? "Courses" : /history/.test(k) ? "Chats" : /memory/.test(k) ? "Memory" : "Settings and progress";
      parts[label] = (parts[label] ?? 0) + size;
    }
  } catch {}
  return { kb: Math.round(total / 1024), parts: Object.entries(parts).map(([label, b]) => ({ label, kb: Math.round(b / 1024) })) };
}

export default function SettingsPage() {
  const mounted = useMounted();
  const router = useRouter();
  const search = useSearchParams();
  const section = (SECTIONS.find((s) => s.id === search.get("s"))?.id ?? "profile") as SectionId;
  const go = (id: SectionId) => router.replace(`/settings?s=${id}`, { scroll: false });
  // Keep the chosen section's tab in view on phones, where the tabs scroll sideways.
  useEffect(() => {
    document.querySelector(".settings-tab.is-on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [section, mounted]);

  if (!mounted) return <PageHeader title="Settings" />;
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <>
      <PageHeader title="Settings" subtitle={current.label} />
      <div className="page-body settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`settings-tab ${id === section ? "is-on" : ""}`} onClick={() => go(id)} aria-current={id === section ? "page" : undefined}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {section === "profile" && <ProfileSection />}
          {section === "style" && <StyleSection />}
          {section === "courses" && <CoursesSection />}
          {section === "model" && <ModelSection />}
          {section === "memory" && <MemorySection />}
          {section === "lessons" && <LessonsSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "advanced" && <AdvancedSection />}
          {section === "data" && <DataSection />}
        </div>
      </div>
    </>
  );
}

function ProfileSection() {
  const profile = useProfile();
  return (
    <section className="card">
      <h2>Profile</h2>
      <p className="hint">Lessons use this to talk to you and pick examples from your work.</p>
      <label className="field">
        <span>Name</span>
        <input value={profile.fullName} onChange={(e) => saveProfile({ fullName: e.target.value })} autoComplete="name" />
        <small>Printed on your certificates.</small>
      </label>
      <label className="field">
        <span>What should we call you?</span>
        <input value={profile.nickname} onChange={(e) => saveProfile({ nickname: e.target.value })} autoComplete="nickname" />
      </label>
      <label className="field">
        <span>Profession or role</span>
        <input value={profile.profession} onChange={(e) => saveProfile({ profession: e.target.value })} />
      </label>
      <div className="field">
        <span>Areas you want to improve</span>
        <AreaPicker value={profile.areas} onChange={(areas) => saveProfile({ areas })} />
      </div>
    </section>
  );
}

function StyleSection() {
  const profile = useProfile();
  return (
    <section className="card">
      <h2>Learning style</h2>
      <p className="hint">Applies to every lesson. A course can override it when you create it.</p>
      <StylePicker value={profile.style} onChange={(style) => saveProfile({ style })} />
    </section>
  );
}

function CoursesSection() {
  const { settings, update } = useSettings();
  return (
    <section className="card">
      <h2>Course defaults</h2>
      <p className="hint">Every new course starts with these. You can change them for a single course while you create it.</p>
      <CourseOptionsForm value={settings.courseDefaults} onChange={(courseDefaults) => update({ ...settings, courseDefaults })} />
    </section>
  );
}

function ModelSection() {
  const { settings, update, model, params } = useSettings();
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((j: { available: Record<string, boolean> }) => setAvailable(j.available))
      .catch(() => {});
  }, []);
  const setParam = (key: string, value: number | string) => update({ ...settings, params: { ...settings.params, [model.id]: { ...params, [key]: value } } });

  return (
    <>
      <section className="card">
        <h2>Default model</h2>
        <p className="hint">The model that writes your lessons, courses and quizzes, and marks typed answers.</p>
        <div className="model-list">
          {MODELS.map((m) => {
            const active = m.id === model.id;
            const ok = available[m.id] !== false;
            return (
              <button key={m.id} className={`model-card ${active ? "is-active" : ""} ${ok ? "" : "is-unavailable"}`} onClick={() => ok && update({ ...settings, modelId: m.id })} aria-pressed={active} aria-disabled={!ok}>
                <span className="model-card-top">
                  <span className="model-name">{m.name}</span>
                  <span className="model-badges">
                    {m.badges.map((b) => (
                      <span key={b} className={`badge badge-${b.toLowerCase()}`}>
                        {b}
                      </span>
                    ))}
                    {active && <Check size={16} aria-hidden="true" />}
                  </span>
                </span>
                <span className="model-vendor">
                  {m.vendor} on {m.providerName}
                </span>
                <span className="model-blurb">{m.blurb}</span>
                <span className="model-reliability">{m.reliability}</span>
                {!ok && <span className="model-missing">Add {m.provider === "groq" ? "GROQ_API_KEY" : "NVIDIA_API_KEY"} to use this model.</span>}
              </button>
            );
          })}
        </div>
        <p className="param-help" style={{ marginTop: 12 }}>
          Photo answers need a model that can see. If yours can&apos;t, Learn OTG uses Kimi K3 or Qwen for the photo when their key is set.
        </p>
      </section>
      <section className="card">
        <h2>Speed and reliability</h2>
        <Toggle
          label="Fast planning"
          help="Course outlines, quizzes and marking typed answers use Qwen on Groq: about 4 seconds instead of 40. Lessons are still written by your default model. Needs GROQ_API_KEY."
          checked={settings.fastPlanning}
          disabled={available["qwen/qwen3.8-27b"] === false}
          onChange={(v) => update({ ...settings, fastPlanning: v })}
        />
        <Toggle
          label="Backup model"
          help="If your model stalls before writing, try the other provider. A recently stalled model is skipped briefly, with a notice. Pages that fail repeatedly also use the backup."
          checked={settings.backupModel}
          onChange={(v) => update({ ...settings, backupModel: v })}
        />
      </section>
      <section className="card">
        <h2>Parameters for {model.name}</h2>
        <div className="param-list">
          {model.params.map((p) => {
            const value = params[p.key];
            return (
              <div className="param" key={p.key}>
                <div className="param-top">
                  <label htmlFor={`p-${p.key}`}>{p.label}</label>
                  <span className="param-value">{p.kind === "slider" ? fmt(Number(value), p.step) : String(value)}</span>
                </div>
                {p.kind === "slider" && <input id={`p-${p.key}`} type="range" min={p.min} max={p.max} step={p.step} value={Number(value)} onChange={(e) => setParam(p.key, Number(e.target.value))} />}
                {p.kind === "int" && (
                  <input
                    id={`p-${p.key}`}
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={p.min}
                    max={p.max}
                    value={Number(value)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setParam(p.key, Math.min(p.max, Math.max(p.min, Math.round(n))));
                    }}
                  />
                )}
                {p.kind === "select" && (
                  <div className="seg" role="radiogroup" aria-label={p.label}>
                    {p.options.map((o) => (
                      <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? "is-on" : ""} onClick={() => setParam(p.key, o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                <p className="param-help">
                  {p.help}{" "}
                  <span className="param-range">
                    {p.kind !== "select" && `Range ${p.min}–${p.max.toLocaleString()}. `}
                    {vendorLabel(p, model.providerName)}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => update({ ...settings, params: { ...settings.params, [model.id]: defaultParams(model) } })}>
            <RotateCcw size={15} aria-hidden="true" /> App defaults
          </button>
          <button
            className="btn btn-sm"
            onClick={() =>
              update({
                ...settings,
                params: { ...settings.params, [model.id]: Object.fromEntries(model.params.map((p) => [p.key, p.vendorDefault === null ? p.appDefault : p.vendorDefault])) },
              })
            }
          >
            {model.providerName} defaults
          </button>
        </div>
      </section>
    </>
  );
}

function MemorySection() {
  const { settings, update } = useSettings();
  const memory = useMemory();
  return (
    <section className="card">
      <h2>Memory &amp; suggestions</h2>
      <p className="hint">Memory keeps track of what you learn and what you find hard, in this browser only, so lessons can build on it.</p>
      <Toggle
        label="Memory"
        help="Remember what you learn and use it in later lessons and chats. Each course can also keep its memory to itself."
        checked={settings.memory}
        onChange={(v) => update({ ...settings, memory: v })}
      />
      <Toggle
        label="Suggestions"
        help="Suggest what to learn next on the Learn page: where to pick up, what to review, and areas you want to improve."
        checked={settings.autoSuggest}
        onChange={(v) => update({ ...settings, autoSuggest: v })}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <Link href="/memory" className="btn btn-sm">
          <Brain size={15} aria-hidden="true" /> See what&apos;s remembered ({memory.length})
        </Link>
        {memory.length > 0 && (
          <button className="btn btn-sm btn-danger" onClick={() => window.confirm("Forget everything in memory?") && forgetAll()}>
            <Trash2 size={15} aria-hidden="true" /> Forget everything
          </button>
        )}
      </div>
    </section>
  );
}

function LessonsSection() {
  const { settings, update, model } = useSettings();
  return (
    <section className="card">
      <h2>Lessons &amp; chat</h2>
      <Toggle
        label="Web browsing"
        help={model.supportsTools ? "Let the tutor search the web for up-to-date facts. Sources appear under each lesson." : `${model.name} can't browse.`}
        checked={settings.browsing && model.supportsTools}
        disabled={!model.supportsTools}
        onChange={(v) => update({ ...settings, browsing: v })}
      />
      <div className="settings-evidence"><h3>Completion evidence</h3><p className="hint">Summarize completed lessons and courses. Sharing is always your choice.</p><div className="seg" role="radiogroup" aria-label="Completion evidence generation">{(["manual", "auto"] as const).map(mode => <button key={mode} type="button" role="radio" aria-checked={settings.evidenceMode === mode} className={settings.evidenceMode === mode ? "is-on" : ""} onClick={() => update({ ...settings, evidenceMode: mode })}>{mode === "manual" ? "Generate when I ask" : "Automatically"}</button>)}</div></div>
      <Toggle label="Instant answer" help="A short answer in a second or two while the full lesson builds." checked={settings.instantAnswer} onChange={(v) => update({ ...settings, instantAnswer: v })} />
      <Toggle label="Show the model's thinking" help="See the reasoning stream while a lesson is being built." checked={settings.showThinking} onChange={(v) => update({ ...settings, showThinking: v })} />
    </section>
  );
}

function AppearanceSection() {
  const { pref, setPref } = useTheme();
  return (
    <section className="card">
      <h2>Appearance</h2>
      <p className="hint">Light, dark, or follow your device.</p>
      <div className="seg" role="radiogroup" aria-label="Theme">
        {(
          [
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "Device", Monitor],
          ] as [ThemePref, string, typeof Sun][]
        ).map(([v, label, Icon]) => (
          <button key={v} type="button" role="radio" aria-checked={pref === v} className={pref === v ? "is-on" : ""} onClick={() => setPref(v)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function AdvancedSection() {
  const { settings, update } = useSettings();
  const [components, setComponents] = useState<SavedComponent[] | null>(null);
  const load = useCallback(async () => {
    try {
      const j = (await (await fetch("/api/components")).json()) as { components: SavedComponent[] };
      setComponents(j.components);
    } catch {
      setComponents([]);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const remove = async (id?: string) => {
    await fetch(id ? `/api/components?id=${encodeURIComponent(id)}` : "/api/components", { method: "DELETE" }).catch(() => {});
    load();
  };
  return (
    <section className="card">
      <h2>Advanced</h2>
      <Toggle label="Show speed stats" help="Time, tokens and speed under each chat lesson." checked={settings.showStats} onChange={(v) => update({ ...settings, showStats: v })} />
      <Toggle
        label="OpenUI inspector"
        help="A debugging panel for lesson code, top-left of the screen. Only works while developing (npm run dev)."
        checked={settings.inspector}
        onChange={(v) => update({ ...settings, inspector: v })}
      />
      <h3 className="opts-title" style={{ marginTop: 20 }}>
        Component memory
      </h3>
      <div className="seg" role="radiogroup" aria-label="Component memory">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={settings.componentMode === m.id} className={settings.componentMode === m.id ? "is-on" : ""} onClick={() => update({ ...settings, componentMode: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="param-help">{MODES.find((m) => m.id === settings.componentMode)?.help}</p>
      <div className="saved-list">
        <div className="saved-head">
          <span>
            <Layers size={14} aria-hidden="true" /> Saved layouts {components ? `(${components.length})` : ""}
          </span>
          {components && components.length > 0 && (
            <button className="link-btn" onClick={() => remove()}>
              Clear all
            </button>
          )}
        </div>
        {components && components.length === 0 && <p className="param-help">Nothing saved yet. Layouts from your lessons appear here automatically.</p>}
        {components?.map((c) => (
          <div key={c.id} className="saved-item">
            <span className="saved-text">
              <strong>{c.label}</strong>
              <small>
                From “{c.topic}” · used {c.uses}×
              </small>
            </span>
            <button className="icon-btn" onClick={() => remove(c.id)} aria-label={`Delete component ${c.label}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataSection() {
  const [use] = useState(storageUse);
  const exportAll = () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("learn-otg:")) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "learn-otg-backup.json";
    a.click();
  };
  return (
    <section className="card">
      <h2>Your data</h2>
      <p className="hint">Everything lives in this browser. Nothing is sent anywhere except to the model while a lesson is written.</p>
      <div className="storage">
        <div className="storage-top">
          <strong>{use.kb.toLocaleString()} KB used</strong>
          <small>Browsers allow about 5,000 KB per site</small>
        </div>
        <span className="progress" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (use.kb / 5000) * 100)}%` }} />
        </span>
        <ul>
          {use.parts.map((p) => (
            <li key={p.label}>
              {p.label}: {p.kb.toLocaleString()} KB
            </li>
          ))}
        </ul>
      </div>
      <div className="row">
        <button className="btn btn-sm" onClick={exportAll}>
          <Download size={15} aria-hidden="true" /> Download a backup
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => window.confirm("Delete all saved chats? Courses, points and settings are kept.") && clearHistory()}>
          <Trash2 size={15} aria-hidden="true" /> Clear chat history
        </button>
      </div>
    </section>
  );
}
