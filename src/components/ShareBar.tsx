"use client";
import { Check, Copy, Download, FileText, ImageDown, MessageCircle, Share2 } from "lucide-react";
import { useCallback, useState, type RefObject } from "react";
import { award } from "@/lib/journey";
import { dataUrlToBlob, downloadBlob, elementToPng, nativeShare, NETWORKS, pngToPdf, slug } from "@/lib/export";
import { ActionPopover, type MenuAnchor } from "./ActionPopover";
export function ShareBar({ title, text, targetRef, compact, persistent, exportAll, disabled, onAsk }: {
  title: string; text: string; targetRef: RefObject<HTMLElement | null>; compact?: boolean; persistent?: boolean; disabled?: boolean; onAsk?: () => void;
  exportAll?: (scope: "lesson" | "course", kind: "png" | "pdf", progress: (s: string) => void) => Promise<void>;
}) {
  const [busy, setBusy] = useState(""); const [scope, setScope] = useState<"page" | "lesson" | "course">("page");
  const [progress, setProgress] = useState(""); const [menu, setMenu] = useState<"save" | "share" | null>(null);
  const [anchor, setAnchor] = useState<MenuAnchor>(); const [copied, setCopied] = useState(false); const [error, setError] = useState("");
  const close = useCallback(() => setMenu(null), []);
  const open = (kind: "save" | "share", el: HTMLElement) => { setAnchor(el.getBoundingClientRect()); setMenu(kind); setError(""); };
  const capture = async () => { if (!targetRef.current) throw new Error("Nothing to save yet."); return elementToPng(targetRef.current); };
  const run = async (name: string, fn: () => Promise<void>) => { setBusy(name); setError(""); try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : "Try again."); } finally { setBusy(""); setProgress(""); } };
  const save = (kind: "png" | "pdf") => run("Saving", async () => {
    if (scope !== "page" && exportAll) await exportAll(scope, kind, setProgress);
    else { const png = await capture(); downloadBlob(kind === "png" ? dataUrlToBlob(png) : await pngToPdf(png, title), `${slug(title)}.${kind}`); }
    close();
  });
  return <section className={`sharebar no-export ${compact ? "is-compact" : ""} ${persistent ? "is-persistent" : ""}`} aria-label="Share and save">
    <div className="lesson-action-row">
      <button className="tool-action" disabled={!!busy || !!disabled} onClick={e => open("share",e.currentTarget)} aria-expanded={menu === "share"}><Share2 size={17} /><span>Share</span></button>
      <button className="tool-action" disabled={!!busy} onClick={e => open("save",e.currentTarget)} aria-expanded={menu === "save"}><Download size={17} /><span>{busy ? `${busy}…` : "Save"}</span></button>
      {onAsk && <button className="tool-action" onClick={onAsk} aria-label="Ask about this lesson"><MessageCircle size={17} /><span>Ask OTG</span></button>}
    </div>
    {menu && anchor && <ActionPopover anchor={anchor} label={menu === "save" ? "Save lesson" : "Share lesson"} onClose={close}>
      <div className="popover-heading">{menu === "save" ? "Save lesson" : "Share lesson"}</div>
      {menu === "save" ? <>
        {exportAll && <label className="menu-field"><span>Content</span><select aria-label="Export scope" value={scope} onChange={e => setScope(e.target.value as typeof scope)} disabled={!!busy}><option value="page">This page</option><option value="lesson">This lesson so far</option><option value="course">Entire course so far</option></select></label>}
        <button className="menu-item" disabled={!!busy || (!!disabled && scope === "page")} onClick={() => void save("png")}><ImageDown size={17}/>{scope === "page" ? "Save image" : "Save images"}</button>
        <button className="menu-item" disabled={!!busy || (!!disabled && scope === "page")} onClick={() => void save("pdf")}><FileText size={17}/>Save PDF</button>
      </> : <>
        <button className="menu-item" disabled={!!busy} onClick={() => void run("Preparing",async()=>{ const png=await capture();const ok = await nativeShare({title,text,png}); if(ok===true){award("share","Shared a lesson");close();}else if(ok===false){downloadBlob(dataUrlToBlob(png),`${slug(title)}.png`);close();} })}><Share2 size={17}/>Share with an image</button>
        {NETWORKS.map(n=><a key={n.id} className="menu-item" href={n.url(text)} target="_blank" rel="noopener noreferrer">{n.label}</a>)}
        <button className="menu-item" onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setError("Copy is unavailable in this browser.");}}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?"Copied":"Copy text"}</button>
      </>}
      {progress && <p className="menu-status" role="status">{progress}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </ActionPopover>}
    {!menu && error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
