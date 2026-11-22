"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { AREAS, STYLE_INFO, saveProfile, type LearningStyle } from "@/lib/profile";

const STYLE_ORDER: LearningStyle[] = ["visual", "balanced", "text"];

export function StylePicker({ value, onChange }: { value: LearningStyle; onChange: (s: LearningStyle) => void }) {
  return (
    <div className="style-grid" role="radiogroup" aria-label="Learning style">
      {STYLE_ORDER.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          className={`style-card ${value === s ? "is-on" : ""}`}
          onClick={() => onChange(s)}
        >
          <span className={`style-art style-art--${s}`} aria-hidden="true">
            {s === "visual" && (
              <>
                <i /> <i /> <i />
              </>
            )}
            {s === "text" && (
              <>
                <b /> <b /> <b /> <b />
              </>
            )}
            {s === "balanced" && (
              <>
                <i /> <b /> <b />
              </>
            )}
          </span>
          <strong>{STYLE_INFO[s].label}</strong>
          <small>{STYLE_INFO[s].blurb}</small>
          {value === s && (
            <span className="style-check" aria-hidden="true">
              <Check size={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function AreaPicker({ value, onChange }: { value: string[]; onChange: (a: string[]) => void }) {
  return (
    <div className="chip-wrap">
      {AREAS.map((a) => {
        const on = value.includes(a);
        return (
          <button
            key={a}
            type="button"
            className={`pick-chip ${on ? "is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
          >
            {on && <Check size={14} aria-hidden="true" />}
            {a}
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [profession, setProfession] = useState("");
  const [style, setStyle] = useState<LearningStyle>("balanced");
  const [areas, setAreas] = useState<string[]>([]);
  const last = 3;

  const finish = () =>
    saveProfile({ done: true, fullName: fullName.trim(), nickname: nickname.trim(), profession: profession.trim(), style, areas });

  const canNext = step === 0 ? fullName.trim().length > 0 : true;

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="onboard-card">
        <div className="onboard-top">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          <div className="onboard-dots" aria-label={`Step ${step + 1} of ${last + 1}`}>
            {Array.from({ length: last + 1 }, (_, i) => (
              <i key={i} className={i <= step ? "is-on" : ""} />
            ))}
          </div>
          <button className="link-btn" onClick={() => finish()}>
            Skip
          </button>
        </div>

        <div className="onboard-body">
          {step === 0 && (
            <>
              <h2 id="ob-title">Welcome to Learn OTG</h2>
              <p>Let&apos;s set this up for you. It takes under a minute, and you can change everything later in Settings.</p>
              <label className="field">
                <span>Your name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ada Obi" autoFocus autoComplete="name" />
              </label>
              <label className="field">
                <span>What should we call you?</span>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Ada" autoComplete="nickname" />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h2 id="ob-title">What do you do?</h2>
              <p>Your lessons will use examples from your work.</p>
              <label className="field">
                <span>Profession or role</span>
                <input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Senior product manager" autoFocus />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2 id="ob-title">How do you like to learn?</h2>
              <p>Pick the mix that suits you. You can switch any time.</p>
              <StylePicker value={style} onChange={setStyle} />
            </>
          )}
          {step === 3 && (
            <>
              <h2 id="ob-title">What do you want to get better at?</h2>
              <p>Choose as many as you like. We&apos;ll use these to suggest what to learn.</p>
              <AreaPicker value={areas} onChange={setAreas} />
            </>
          )}
        </div>

        <div className="onboard-foot">
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          {step < last ? (
            <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish}>
              Start learning <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
