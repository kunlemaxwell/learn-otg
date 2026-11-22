"use client";
// Turn a lesson (or any element) into an image or PDF, and share it.

function bgColor(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  return v || "#F3F5F1";
}

async function waitForPaint() {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (document.fonts?.ready) await document.fonts.ready;
}

let embeddedFonts: Promise<string> | null = null;
async function exportFonts(): Promise<string> {
  if (embeddedFonts) return embeddedFonts;
  embeddedFonts = (async () => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter(l => l.href.startsWith("https://fonts.googleapis.com/"));
    const sheets = await Promise.all(links.map(async l => {
      try {
        const res = await fetch(l.href, { signal: AbortSignal.timeout(8000) }); if (!res.ok) return "";
        let css = await res.text();
        const urls = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/["']/g, "")))];
        const embedded = await Promise.all(urls.map(async url => {
          try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (!r.ok) return [url, ""];
            const blob = await r.blob(); const data = await new Promise<string>(resolve => { const f = new FileReader(); f.onload = () => resolve(String(f.result)); f.onerror = () => resolve(""); f.readAsDataURL(blob); }); return [url, data];
          } catch { return [url, ""]; }
        }));
        for (const [url, data] of embedded) css = css.split(url).join(data);
        return css;
      } catch { return ""; }
    }));
    return sheets.join("\n");
  })();
  return embeddedFonts;
}

export async function elementToPng(el: HTMLElement, opts: { pixelRatio?: number; background?: string } = {}): Promise<string> {
  const { toPng } = await import("html-to-image");
  await waitForPaint();
  return toPng(el, {
    pixelRatio: opts.pixelRatio ?? 2,
    backgroundColor: opts.background ?? bgColor(),
    cacheBust: true,
    fontEmbedCSS: (await exportFonts()) || "/* Use local fallback fonts. */",
    style: { position: "relative", left: "0", top: "0", margin: "0", transform: "none" },
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-export")),
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "learn-otg";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });

/** Paginated A4 PDF from a PNG data URL (portrait). */
export async function pngToPdf(dataUrl: string, title: string): Promise<Blob> {
  return pngsToPdf((async function* () { yield { png: dataUrl }; })(), title);
}

/** Capture one page at a time so a whole course never needs a single giant canvas. */
export async function pngsToPdf(images: AsyncIterable<{ png: string }>, title: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28, usableW = pageW - margin * 2, usableH = pageH - margin * 2;
  pdf.setProperties({ title });
  const bg = bgColor();
  let count = 0;
  for await (const item of images) {
    const img = await loadImage(item.png);
    const scale = usableW / img.width;
    const sliceH = Math.max(1, Math.floor(usableH / scale));
    for (let y = 0; y < img.height; y += sliceH) {
      const h = Math.min(sliceH, img.height - y);
      const c = document.createElement("canvas"); c.width = img.width; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("This browser couldn't create the export image.");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);
      if (count++ > 0) pdf.addPage();
      pdf.setFillColor(bg); pdf.rect(0, 0, pageW, pageH, "F");
      pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, h * scale);
    }
  }
  return pdf.output("blob");
}

/** One-page PDF sized to a landscape certificate. */
export async function certificatePdf(dataUrl: string, title: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const img = await loadImage(dataUrl);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r;
  const dh = img.height * r;
  pdf.setProperties({ title });
  pdf.addImage(dataUrl, "PNG", (w - dw) / 2, (h - dh) / 2, dw, dh);
  return pdf.output("blob");
}

export type Network = { id: string; label: string; url: (text: string, link?: string) => string };

const enc = encodeURIComponent;
export const NETWORKS: Network[] = [
  { id: "x", label: "X", url: (t, l) => `https://twitter.com/intent/tweet?text=${enc(t)}${l ? `&url=${enc(l)}` : ""}` },
  { id: "linkedin", label: "LinkedIn", url: (t, l) => `https://www.linkedin.com/feed/?shareActive=true&text=${enc(l ? `${t} ${l}` : t)}` },
  { id: "whatsapp", label: "WhatsApp", url: (t, l) => `https://wa.me/?text=${enc(l ? `${t} ${l}` : t)}` },
  { id: "facebook", label: "Facebook", url: (t, l) => `https://www.facebook.com/sharer/sharer.php?quote=${enc(t)}${l ? `&u=${enc(l)}` : ""}` },
  { id: "email", label: "Email", url: (t) => `mailto:?subject=${enc("Something I learned")}&body=${enc(t)}` },
];

export async function nativeShare(opts: { title: string; text: string; png?: string }): Promise<boolean | "cancelled"> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    if (opts.png) {
      const file = new File([dataUrlToBlob(opts.png)], `${slug(opts.title)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: opts.title, text: opts.text, files: [file] });
        return true;
      }
    }
    await navigator.share({ title: opts.title, text: opts.text });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled"; // user closed the sheet
    return false;
  }
}