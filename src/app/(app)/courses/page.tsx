"use client";

import { GraduationCap, Plus, Star } from "lucide-react";
import Link from "next/link";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { courseProgress, putCourse, useCourses } from "@/lib/courses";
import { relativeTime } from "@/lib/history";

export default function CoursesPage() {
  const mounted = useMounted();
  const courses = useCourses();
  const active = courses.filter((c) => !c.completedAt);
  const done = courses.filter((c) => c.completedAt);

  const card = (c: (typeof courses)[number]) => {
    const p = courseProgress(c);
    return (
      <article key={c.id} className={`lib-card m-${c.mood}`}>
        <Link href={`/courses/${c.id}`} className="lib-card-main">
          <span className="lib-card-art" aria-hidden="true">
            <GraduationCap size={26} />
          </span>
          <span className="eyebrow">{c.completedAt ? "Completed" : c.level}</span>
          <strong>{c.title}</strong>
          <span className="lib-snippet">{c.blurb}</span>
          <span className="progress" aria-label={`${Math.round(p.pct * 100)}% complete`}>
            <i style={{ width: `${Math.round(p.pct * 100)}%` }} />
          </span>
          <span className="lib-meta">
            {p.done}/{p.total} lessons · {relativeTime(c.updatedAt)}
          </span>
        </Link>
        <div className="lib-actions">
          <button className={`icon-btn ${c.saved ? "is-starred" : ""}`} onClick={() => putCourse({ ...c, saved: !c.saved })} aria-pressed={c.saved} aria-label={c.saved ? "Remove from saved" : "Save for later"}>
            <Star size={18} fill={c.saved ? "currentColor" : "none"} />
          </button>
        </div>
      </article>
    );
  };

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Full courses with lessons, quizzes and a certificate"
        actions={
          <Link href="/courses/new" className="btn btn-primary btn-sm">
            <Plus size={16} aria-hidden="true" /> New course
          </Link>
        }
      />
      <div className="page-body">
        {mounted && courses.length === 0 && (
          <div className="empty">
            <span className="empty-icon">
              <GraduationCap size={28} />
            </span>
            <h3>Build your first course</h3>
            <p>Describe what you want to learn, add notes or documents if you have them, and Learn OTG writes the whole course.</p>
            <Link href="/courses/new" className="btn btn-primary">
              <Plus size={16} aria-hidden="true" /> New course
            </Link>
          </div>
        )}
        {active.length > 0 && (
          <>
            <h2 className="section-title">In progress and saved</h2>
            <div className="lib-cards">{active.map(card)}</div>
          </>
        )}
        {done.length > 0 && (
          <>
            <h2 className="section-title">Completed</h2>
            <div className="lib-cards">{done.map(card)}</div>
          </>
        )}
      </div>
    </>
  );
}
