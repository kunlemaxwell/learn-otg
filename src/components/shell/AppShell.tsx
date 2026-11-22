"use client";

import {
  Award,
  NotebookPen,
  Brain,
  Flame,
  GraduationCap,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { callName, useProfile } from "@/lib/profile";
import { levelName, levelOf, streakOf, totalPoints, useJourney } from "@/lib/journey";
import { useTheme } from "@/lib/theme";
import { evidenceKey, generateEvidence, useEvidence } from "@/lib/completion-evidence";
import { NotificationCenter } from "./NotificationCenter";
import { Onboarding } from "./Onboarding";
import { ChatDock } from "./ChatDock";
import { issueCertificate } from "@/lib/certificates";
import { allLessons, isComplete, patchCourse, useCourses } from "@/lib/courses";
import { award } from "@/lib/journey";
import { recoverAndResume } from "@/lib/lesson-engine";
import { useSettings } from "@/lib/settings";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";

const NAV = [
  { href: "/", label: "Learn", icon: Sparkles },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/journey", label: "Journey", icon: Flame },
  { href: "/notebooks", label: "Notebooks", icon: NotebookPen },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/evidence", label: "Evidence", icon: Award },
  { href: "/certificates", label: "Certificates", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ShellContext = createContext<{ openNav: () => void; openChat: (() => void) | null }>({ openNav: () => {}, openChat: null });
export const useShell = () => useContext(ShellContext);

const noopSub = () => () => {};
/** False during server render and hydration, true afterwards. */
export function useMounted() {
  return useSyncExternalStore(noopSub, () => true, () => false);
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const path = usePathname();
  return (
    <nav className="nav-list" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`nav-item ${on ? "is-on" : ""}`} onClick={onNavigate} aria-current={on ? "page" : undefined} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SideFooter({ collapsed }: { collapsed?: boolean }) {
  const journey = useJourney();
  const profile = useProfile();
  const mounted = useMounted();
  const { resolved, setPref } = useTheme();
  const pts = totalPoints(journey);
  const lv = levelOf(pts);
  const streak = streakOf(journey).current;
  const name = callName(profile);
  return (
    <div className="side-foot">
      <Link href="/journey" className="side-stat" aria-label="Open your journey" title={collapsed ? `${pts} points · ${streak}-day streak` : undefined}>
        <span className="side-flame" aria-hidden="true">
          <Flame size={16} />
          {mounted ? streak : 0}
        </span>
        <span className="side-level">
          <strong>{mounted ? pts.toLocaleString() : 0} pts</strong>
          <small>
            Level {mounted ? lv.level : 1} · {levelName(mounted ? lv.level : 1)}
          </small>
        </span>
      </Link>
      <div className="side-row">
        <span className="side-name">{mounted && name ? name : "Learner"}</span>
        <button className="icon-btn" onClick={() => setPref(resolved === "dark" ? "light" : "dark")} aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {resolved === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}

/** OpenUI's Inspect widget, only in development and only when switched on in Settings (top-left, away from the chat). */
function Inspector() {
  const [Comp, setComp] = useState<ComponentType<{ position: string; enabled: boolean }> | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    import("@openuidev/devtools")
      .then((m) => setComp(() => m.OpenUIDevtools as unknown as ComponentType<{ position: string; enabled: boolean }>))
      .catch(() => {});
  }, []);
  return Comp ? <Comp position="top-left" enabled /> : null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [storageFull, setStorageFull] = useState(false);
  const mounted = useMounted();
  const profile = useProfile();
  const courses = useCourses();
  const evidence = useEvidence();
  const ui = useUiPrefs();
  const { settings } = useSettings();
  const path = usePathname();
  useEffect(() => { document.querySelector(".shell-main")?.scrollTo({ top: 0 }); }, [path]);
  const collapsed = mounted && ui.navCollapsed;
  const dockable = path !== "/" && !path.startsWith("/chats") && !/\/lesson\//.test(path);

  // Pick up where generation left off: reset pages orphaned by a reload, resume "write everything now".
  useEffect(() => {
    if (!mounted) return;
    recoverAndResume();
    const t = setInterval(recoverAndResume, 15_000);
    return () => clearInterval(t);
  }, [mounted]);

  useEffect(() => {
    const onFull = () => setStorageFull(true);
    window.addEventListener("learn-otg:storage-full", onFull);
    return () => window.removeEventListener("learn-otg:storage-full", onFull);
  }, []);

  // A course is complete when every lesson is done and every quiz is passed: award points and the certificate once.
  useEffect(() => {
    if (!mounted) return;
    for (const c of courses) {
      if (c.completedAt || !isComplete(c)) continue;
      patchCourse(c.id, (x) => ({ ...x, completedAt: Date.now() }));
      award("course", `Completed ${c.title}`);
      if (c.options.certificate) {
        issueCertificate({
          courseId: c.id,
          courseTitle: c.title,
          recipient: profile.fullName || callName(profile) || "Learner",
          designId: c.options.certificateTemplate,
        });
        award("certificate", "Earned a certificate");
      }
    }
  }, [courses, mounted, profile]);
  useEffect(() => {
    if (!mounted || settings.evidenceMode !== "auto") return;
    for (const c of courses) {
      for (const {lesson} of allLessons(c)) {
        if (lesson.done && !evidence.some(e => e.scopeKey === evidenceKey([c.id], lesson.id))) void generateEvidence([c.id], lesson.id).catch(() => {});
      }
      if (c.completedAt && !evidence.some(e => e.scopeKey === evidenceKey([c.id]))) void generateEvidence([c.id]).catch(() => {});
    }
  }, [courses, evidence, mounted, settings.evidenceMode]);
  useTheme(); // applies the saved theme and follows the system when set to "system"

  return (
    <ShellContext.Provider value={{ openNav: () => setOpen(true), openChat: dockable ? () => setDockOpen(true) : null }}>
      <div className={`shell ${collapsed ? "nav-collapsed" : ""} ${dockable && dockOpen ? "has-dock" : ""}`}>
        <aside className="side" aria-label="Sidebar">
          <div className="side-top">
            <Link href="/" className="brand side-brand" aria-label="Learn OTG home">
              <span className="brand-mark" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <span className="brand-name">
                Learn <span className="brand-otg">OTG</span>
              </span>
            </Link>
            <button
              className="icon-btn side-fold"
              onClick={() => setUiPrefs({ navCollapsed: !ui.navCollapsed })}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          <NavList collapsed={collapsed} />
          <SideFooter collapsed={collapsed} />
        </aside>

        {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
        <aside className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Menu">
          <div className="drawer-head">
            <span className="brand-name">
              Learn <span className="brand-otg">OTG</span>
            </span>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
          <NavList onNavigate={() => setOpen(false)} />
          <SideFooter />
        </aside>

        <div className="shell-main">{children}</div>
        {mounted && dockable && <ChatDock open={dockOpen} setOpen={setDockOpen} />}
      </div>

      {storageFull && (
        <div className="toast" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>This browser&apos;s storage is full, so new progress may not be saved. Delete old chats or courses, or download a backup in Settings.</span>
          <button className="icon-btn" onClick={() => setStorageFull(false)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {mounted && !profile.done && <Onboarding />}
      {mounted && settings.inspector && <Inspector />}
    </ShellContext.Provider>
  );
}

/** Top bar for pages other than the lesson canvas. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const { openNav, openChat } = useShell();
  return (
    <header className="page-head">
      <button className="icon-btn menu-btn" onClick={openNav} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="page-head-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {(
        <div className="page-head-actions">
          {actions}
          <NotificationCenter />
          {openChat && (
            <button className="icon-btn head-chat" onClick={openChat} aria-label="Ask about this page" title="Ask about this page">
              <MessageCircle size={20} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
