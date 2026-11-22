"use client";
import { Bell, Check, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCourses, allLessons } from "@/lib/courses";
import { clearNotifications, markRead, notify, useNotifications, type Notice } from "@/lib/notifications";
import { dayKey } from "@/lib/journey";
import { relativeTime } from "@/lib/history";
export function NotificationCenter() {
  const notices = useNotifications();
  const courses = useCourses();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notices.filter(n => !n.read).length;
  useEffect(() => {
    const onNotice = (e: Event) => setToast((e as CustomEvent<Notice>).detail);
    window.addEventListener("learn-otg:notice", onNotice);
    return () => window.removeEventListener("learn-otg:notice", onNotice);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const c = courses.find(c => !c.completedAt && allLessons(c).some(x => x.lesson.done));
    if (!c) return;
    const lesson = allLessons(c).find(x => !x.lesson.done)?.lesson;
    if (lesson) notify({ id: `continue-${c.id}-${dayKey(Date.now())}`, title: `Continue ${c.title}`, detail: `Next: ${lesson.title}`, href: `/courses/${c.id}/lesson/${lesson.id}` });
  }, [courses]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div className="notification-center no-export" ref={ref} onKeyDown={e => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }}>
    <button className="icon-btn notification-bell" onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls="notification-list"><Bell size={18} />{unread > 0 && <span>{Math.min(unread, 99)}</span>}</button>
    {open && <section className="notification-list" id="notification-list" aria-label="Notifications"><div className="row spread"><h2>Notifications</h2><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={18} /></button></div><div className="row"><button className="link-btn" onClick={() => markRead()}>Mark all read</button><button className="link-btn" onClick={clearNotifications}>Clear</button></div>
      {!notices.length && <p className="hint">Your points, completions and reminders will appear here.</p>}
      <ul>{notices.slice(0, 30).map(n => <li key={n.id} className={n.read ? "is-read" : ""}>{n.href ? <Link href={n.href} onClick={() => { markRead(n.id); setOpen(false); }}><strong>{n.title}</strong>{n.detail && <small>{n.detail}</small>}</Link> : <div><strong>{n.title}</strong>{n.detail && <small>{n.detail}</small>}</div>}<div className="row spread"><small>{relativeTime(n.ts)}</small>{!n.read && <button className="icon-btn" onClick={() => markRead(n.id)} aria-label={`Mark ${n.title} read`}><Check size={14} /></button>}</div></li>)}</ul>
    </section>}
    {toast && !open && <div className="notification-toast" role="status"><div><strong>{toast.title}</strong>{toast.detail && <small>{toast.detail}</small>}</div><button className="icon-btn" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
  </div>;
}
