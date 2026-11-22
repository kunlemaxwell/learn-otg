"use client";

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CertDesign } from "@/lib/certificates";

export const CERT_W = 1000;
export const CERT_H = 707;

const FONT: Record<CertDesign["heading"], string> = {
  serif: 'Georgia, "Times New Roman", serif',
  display: "var(--font-display)",
  sans: "var(--font-sans)",
};

function Pattern({ d }: { d: CertDesign }) {
  const c = d.accent;
  if (d.pattern === "dots")
    return (
      <svg width={CERT_W} height={CERT_H} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <defs>
          <pattern id={`dots-${d.id}`} width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" fill={c} opacity="0.16" />
          </pattern>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill={`url(#dots-${d.id})`} />
      </svg>
    );
  if (d.pattern === "stripes")
    return (
      <svg width={CERT_W} height={CERT_H} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <defs>
          <pattern id={`st-${d.id}`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="22" fill={c} opacity="0.12" />
          </pattern>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill={`url(#st-${d.id})`} />
      </svg>
    );
  if (d.pattern === "rings")
    return (
      <svg width={CERT_W} height={CERT_H} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        {[360, 280, 200].map((r, i) => (
          <circle key={r} cx={CERT_W + 20} cy={-30} r={r} fill="none" stroke={c} strokeWidth="2" opacity={0.2 - i * 0.04} />
        ))}
        {[300, 220, 140].map((r, i) => (
          <circle key={r} cx={-20} cy={CERT_H + 30} r={r} fill="none" stroke={c} strokeWidth="2" opacity={0.2 - i * 0.04} />
        ))}
      </svg>
    );
  return null;
}

function Frame({ d }: { d: CertDesign }) {
  const base: CSSProperties = { position: "absolute", pointerEvents: "none" };
  if (d.frame === "line") return <div style={{ ...base, inset: 28, border: `3px solid ${d.accent}`, borderRadius: 6 }} />;
  if (d.frame === "double")
    return (
      <>
        <div style={{ ...base, inset: 24, border: `5px solid ${d.accent}` }} />
        <div style={{ ...base, inset: 38, border: `1.5px solid ${d.accent}` }} />
      </>
    );
  if (d.frame === "corners") {
    const c = (pos: CSSProperties) => (
      <div style={{ ...base, width: 90, height: 90, ...pos }} />
    );
    const b = `8px solid ${d.accent}`;
    return (
      <>
        {c({ top: 26, left: 26, borderTop: b, borderLeft: b })}
        {c({ top: 26, right: 26, borderTop: b, borderRight: b })}
        {c({ bottom: 26, left: 26, borderBottom: b, borderLeft: b })}
        {c({ bottom: 26, right: 26, borderBottom: b, borderRight: b })}
      </>
    );
  }
  return null;
}

export type CertData = { recipient: string; course: string; date: string; code: string };

/** The certificate at its natural 1000×707 size. Export captures this element. */
export const CertificateCanvas = forwardRef<HTMLDivElement, { design: CertDesign; data: CertData }>(function CertificateCanvas(
  { design: d, data },
  ref,
) {
  const heading = FONT[d.heading];
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: CERT_W,
        height: CERT_H,
        background: d.bg,
        color: d.ink,
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        flex: "none",
      }}
    >
      <Pattern d={d} />
      <Frame d={d} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "70px 110px",
          gap: 14,
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: d.accent, display: "grid", placeItems: "center" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={d.bg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 15.6 7 18.4l1.1-5.6L4 8.9l5.6-.7z" />
          </svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: d.accent, marginTop: 6 }}>
          {d.title}
        </div>
        <div style={{ fontSize: 20, opacity: 0.75 }}>{d.line}</div>
        <div
          style={{
            fontFamily: heading,
            fontSize: data.recipient.length > 22 ? 56 : 72,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            padding: "4px 0 10px",
            borderBottom: `3px solid ${d.accent}`,
            maxWidth: "100%",
          }}
        >
          {data.recipient || "Your name"}
        </div>
        <div style={{ fontSize: 20, opacity: 0.75, marginTop: 6 }}>for completing</div>
        <div style={{ fontFamily: heading, fontSize: 34, fontWeight: 650, lineHeight: 1.15, maxWidth: 760 }}>{data.course || "Course title"}</div>
        <div style={{ display: "flex", gap: 60, marginTop: 26, alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.date}</div>
            <div style={{ borderTop: `1.5px solid ${d.ink}`, opacity: 0.5, marginTop: 6, width: 180 }} />
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Date</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: heading, fontStyle: "italic", fontSize: 26 }}>{d.signer}</div>
            <div style={{ borderTop: `1.5px solid ${d.ink}`, opacity: 0.5, marginTop: 6, width: 180 }} />
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{d.signerRole}</div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 54, fontSize: 12, letterSpacing: "0.12em", opacity: 0.55 }}>Certificate ID {data.code}</div>
      </div>
    </div>
  );
});

/** Scales a fixed-size child to the width of its container. */
export function FitBox({ children, width = CERT_W, height = CERT_H }: { children: ReactNode; width?: number; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={wrap} style={{ width: "100%", height: height * scale, position: "relative", overflow: "hidden", borderRadius: 10 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width, height, position: "absolute", top: 0, left: 0 }}>{children}</div>
    </div>
  );
}

export function CertificateThumb({ design, data }: { design: CertDesign; data: CertData }) {
  return (
    <FitBox>
      <CertificateCanvas design={design} data={data} />
    </FitBox>
  );
}
