"use client";

import { Award, Check, Copy, FileText, ImageDown, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CertificateCanvas, FitBox, type CertData } from "@/components/CertificateView";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { allDesigns, BUILTIN_CERTS, findDesign, newDesignFrom, removeDesign, removeEarned, saveDesign, useCertStore, useEarned, type CertDesign, type Earned } from "@/lib/certificates";
import { certificatePdf, dataUrlToBlob, downloadBlob, elementToPng, nativeShare, NETWORKS, slug } from "@/lib/export";
import { award } from "@/lib/journey";
import { callName, useProfile } from "@/lib/profile";
import { useSettings } from "@/lib/settings";

const dateText = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function EarnedCard({ e }: { e: Earned }) {
  const ref = useRef<HTMLDivElement>(null);
  const design = findDesign(e.designId);
  const [busy, setBusy] = useState("");
  const [nets, setNets] = useState(false);
  const data: CertData = { recipient: e.recipient, course: e.courseTitle, date: dateText(e.issuedAt), code: e.code };
  const text = `I completed "${e.courseTitle}" on Learn OTG and earned a certificate.`;

  const png = () => elementToPng(ref.current!, { pixelRatio: 2, background: design.bg });
  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch {
      window.alert("That didn't work. Try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <article className="card cert-earned">
      <FitBox>
        <CertificateCanvas ref={ref} design={design} data={data} />
      </FitBox>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => run("png", async () => downloadBlob(dataUrlToBlob(await png()), `${slug(e.courseTitle)}-certificate.png`))}>
          <ImageDown size={15} aria-hidden="true" /> Image
        </button>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => run("pdf", async () => downloadBlob(await certificatePdf(await png(), e.courseTitle), `${slug(e.courseTitle)}-certificate.pdf`))}>
          <FileText size={15} aria-hidden="true" /> PDF
        </button>
        <button
          className="btn btn-sm"
          disabled={!!busy}
          onClick={() =>
            run("share", async () => {
              const ok = await nativeShare({ title: e.courseTitle, text, png: await png() });
              if (ok === true) award("share", "Shared a certificate");
              else if (ok === false) setNets(true);
            })
          }
        >
          <Share2 size={15} aria-hidden="true" /> Share
        </button>
        <button className="icon-btn" aria-label="Delete certificate" onClick={() => window.confirm("Remove this certificate?") && removeEarned(e.id)}>
          <Trash2 size={16} />
        </button>
      </div>
      {nets && (
        <div className="chip-wrap" style={{ marginTop: 10 }}>
          {NETWORKS.map((n) => (
            <a key={n.id} className="pick-chip" href={n.url(text)} target="_blank" rel="noopener noreferrer" onClick={() => award("share", `Shared on ${n.label}`)}>
              {n.label}
            </a>
          ))}
          <button className="pick-chip" onClick={() => navigator.clipboard?.writeText(text)}>
            <Copy size={14} aria-hidden="true" /> Copy text
          </button>
        </div>
      )}
    </article>
  );
}

const COLOR_FIELDS: { key: "bg" | "ink" | "accent"; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "ink", label: "Text" },
  { key: "accent", label: "Accent" },
];

function Designer() {
  const store = useCertStore();
  const designs = allDesigns(store);
  const { settings, update } = useSettings();
  const profile = useProfile();
  const [draft, setDraft] = useState<CertDesign>(BUILTIN_CERTS[0]);
  const ref = useRef<HTMLDivElement>(null);
  const isCustom = !draft.builtin && store.custom.some((c) => c.id === draft.id);
  const isDefault = settings.courseDefaults.certificateTemplate === draft.id;
  const sample: CertData = { recipient: profile.fullName || callName(profile) || "Your name", course: "Your course title", date: "Today", code: "OTG-SAMPLE" };

  const set = <K extends keyof CertDesign>(k: K, v: CertDesign[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div className="designer">
      <section className="card">
        <h2>Templates</h2>
        <p className="hint">Start from a template, then change it to suit. Save it to reuse on any course.</p>
        <div className="tpl-list">
          {designs.map((d) => (
            <button key={d.id} className={`tpl ${draft.id === d.id ? "is-on" : ""}`} onClick={() => setDraft(d)} aria-pressed={draft.id === d.id}>
              <span className="tpl-swatch" style={{ background: d.bg, borderColor: d.accent }}>
                <i style={{ background: d.accent }} />
              </span>
              {d.name}
            </button>
          ))}
          <button className="tpl" onClick={() => setDraft(newDesignFrom(draft))}>
            <span className="tpl-swatch tpl-new">
              <Plus size={16} />
            </span>
            New from this
          </button>
        </div>
      </section>

      <section className="card">
        <FitBox>
          <CertificateCanvas ref={ref} design={draft} data={sample} />
        </FitBox>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={async () => downloadBlob(dataUrlToBlob(await elementToPng(ref.current!, { pixelRatio: 2, background: draft.bg })), `${slug(draft.name)}-sample.png`)}>
            <ImageDown size={15} aria-hidden="true" /> Download sample
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Edit</h2>
        <label className="field">
          <span>Template name</span>
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Heading</span>
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field">
          <span>Line before the name</span>
          <input value={draft.line} onChange={(e) => set("line", e.target.value)} />
        </label>
        <div className="two">
          <label className="field">
            <span>Signed by</span>
            <input value={draft.signer} onChange={(e) => set("signer", e.target.value)} />
          </label>
          <label className="field">
            <span>Role</span>
            <input value={draft.signerRole} onChange={(e) => set("signerRole", e.target.value)} />
          </label>
        </div>
        <div className="colors">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="color-field">
              <input type="color" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-label={f.label} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        <div className="field">
          <span>Frame</span>
          <div className="seg">
            {(["none", "line", "double", "corners"] as const).map((v) => (
              <button key={v} className={draft.frame === v ? "is-on" : ""} onClick={() => set("frame", v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Name font</span>
          <div className="seg">
            {(["serif", "display", "sans"] as const).map((v) => (
              <button key={v} className={draft.heading === v ? "is-on" : ""} onClick={() => set("heading", v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Pattern</span>
          <div className="seg">
            {(["none", "dots", "stripes", "rings"] as const).map((v) => (
              <button key={v} className={draft.pattern === v ? "is-on" : ""} onClick={() => set("pattern", v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={() => saveDesign({ ...draft, builtin: false, id: draft.builtin ? newDesignFrom(draft).id : draft.id })}
          >
            <Check size={16} aria-hidden="true" /> {isCustom ? "Save changes" : "Save as my template"}
          </button>
          <button className="btn" onClick={() => update({ ...settings, courseDefaults: { ...settings.courseDefaults, certificateTemplate: draft.id } })} disabled={isDefault || (!isCustom && !draft.builtin)}>
            {isDefault ? "Default for new courses" : "Use as default"}
          </button>
          {isCustom && (
            <button className="btn btn-danger" onClick={() => { removeDesign(draft.id); setDraft(BUILTIN_CERTS[0]); }}>
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function CertificatesPage() {
  const mounted = useMounted();
  const earned = useEarned();
  const [tab, setTab] = useState<"earned" | "design">("earned");

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle="Earn them by finishing courses, and design your own"
        actions={
          <div className="seg" role="tablist" aria-label="Certificates">
            <button role="tab" aria-selected={tab === "earned"} className={tab === "earned" ? "is-on" : ""} onClick={() => setTab("earned")}>
              Earned
            </button>
            <button role="tab" aria-selected={tab === "design"} className={tab === "design" ? "is-on" : ""} onClick={() => setTab("design")}>
              Design
            </button>
          </div>
        }
      />
      <div className="page-body">
        {tab === "earned" && mounted && (
          <>
            {earned.length === 0 && (
              <div className="empty">
                <span className="empty-icon">
                  <Award size={28} />
                </span>
                <h3>No certificates yet</h3>
                <p>Finish every lesson in a course and pass its quizzes to earn one.</p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <Link href="/courses" className="btn btn-primary">
                    Go to courses
                  </Link>
                  <button className="btn" onClick={() => setTab("design")}>
                    Design a certificate
                  </button>
                </div>
              </div>
            )}
            <div className="cert-grid">
              {earned.map((e) => (
                <EarnedCard key={e.id} e={e} />
              ))}
            </div>
          </>
        )}
        {tab === "design" && mounted && <Designer />}
      </div>
    </>
  );
}
