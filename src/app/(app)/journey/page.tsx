"use client";

import { Award, Check, Flame, Plus, Sparkles, Target, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { courseProgress, useCourses } from "@/lib/courses";
import { relativeTime } from "@/lib/history";
import { addGoal, badgesOf, lastDays, levelName, levelOf, removeGoal, streakOf, toggleGoal, totalPoints, useJourney } from "@/lib/journey";
import { callName, useProfile } from "@/lib/profile";

export default function JourneyPage() {
  const mounted = useMounted();
  const j = useJourney();
  const profile = useProfile();
  const courses = useCourses();
  const [goal, setGoal] = useState("");

  if (!mounted) return <PageHeader title="Journey" />;

  const pts = totalPoints(j);
  const lv = levelOf(pts);
  const streak = streakOf(j);
  const days = lastDays(j, 14);
  const maxDay = Math.max(...days.map((d) => d.points), 1);
  const badges = badgesOf(j);
  const name = callName(profile);
  const inProgress = courses.filter((c) => !c.completedAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) addGoal(goal);
    setGoal("");
  };

  return (
    <>
      <PageHeader title="Journey" subtitle={name ? `${name}'s learning so far` : "Your learning so far"} />
      <div className="page-body">
        <div className="j-top">
          <section className="j-streak m-sun">
            <Flame size={34} aria-hidden="true" />
            <div>
              <div className="j-big">{streak.current}</div>
              <div className="j-label">day streak</div>
            </div>
            <p>{streak.today ? "You've learned today. Come back tomorrow to keep it going." : streak.current > 0 ? "Learn something today to keep your streak alive." : "Learn something today to start a streak."}</p>
            <small>Best: {streak.best} day{streak.best === 1 ? "" : "s"}</small>
          </section>

          <section className="j-level m-forest">
            <div className="row spread">
              <div>
                <span className="eyebrow">Level {lv.level}</span>
                <div className="j-name">{levelName(lv.level)}</div>
              </div>
              <div className="j-pts">
                <Trophy size={18} aria-hidden="true" /> {pts.toLocaleString()} pts
              </div>
            </div>
            <div className="progress" aria-label={`${lv.into} of ${lv.span} points to the next level`}>
              <i style={{ width: `${Math.min(100, (lv.into / lv.span) * 100)}%` }} />
            </div>
            <small>{lv.next - pts} points to level {lv.level + 1}</small>
          </section>
        </div>

        <section className="card">
          <h2>Last 14 days</h2>
          <div className="j-chart" role="img" aria-label="Points earned each day for the last 14 days">
            {days.map((d, i) => (
              <div key={d.key} className="j-bar">
                <i style={{ height: `${Math.max(4, (d.points / maxDay) * 100)}%` }} className={d.points ? "has" : ""} title={`${d.points} points`} />
                <span>{i % 2 === 0 || days.length < 8 ? d.label : ""}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>
            <Target size={18} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> What I want to learn
          </h2>
          <p className="hint">Add goals, then turn them into a lesson or a course.</p>
          <form className="goal-add" onSubmit={submit}>
            <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Understand how interest rates work" aria-label="Add a learning goal" />
            <button className="btn btn-primary" type="submit" disabled={!goal.trim()}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          </form>
          {profile.areas.length > 0 && j.goals.length === 0 && (
            <div className="chip-wrap" style={{ marginTop: 10 }}>
              {profile.areas.slice(0, 5).map((a) => (
                <button key={a} className="pick-chip" onClick={() => addGoal(`Get better at ${a.toLowerCase()}`)}>
                  <Plus size={13} aria-hidden="true" /> {a}
                </button>
              ))}
            </div>
          )}
          <ul className="goal-list">
            {j.goals.map((g) => (
              <li key={g.id} className={g.doneAt ? "is-done" : ""}>
                <button className="goal-check" onClick={() => toggleGoal(g.id)} aria-pressed={!!g.doneAt} aria-label={g.doneAt ? "Mark as not done" : "Mark as done"}>
                  {g.doneAt && <Check size={14} />}
                </button>
                <span className="grow">{g.text}</span>
                {!g.doneAt && (
                  <>
                    <Link href={`/?q=${encodeURIComponent(g.text)}`} className="link-btn">
                      Lesson
                    </Link>
                    <Link href={`/courses/new?topic=${encodeURIComponent(g.text)}`} className="link-btn">
                      Course
                    </Link>
                  </>
                )}
                <button className="icon-btn" onClick={() => removeGoal(g.id)} aria-label="Remove goal">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {inProgress.length > 0 && (
          <section className="card">
            <h2>Keep going</h2>
            <ul className="goal-list">
              {inProgress.slice(0, 4).map((c) => {
                const p = courseProgress(c);
                return (
                  <li key={c.id}>
                    <Link href={`/courses/${c.id}`} className="grow j-course">
                      <strong>{c.title}</strong>
                      <span className="progress">
                        <i style={{ width: `${Math.round(p.pct * 100)}%` }} />
                      </span>
                    </Link>
                    <small className="muted">
                      {p.done}/{p.total}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>
            <Award size={18} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Badges
          </h2>
          <div className="badge-grid">
            {badges.map((b) => (
              <div key={b.id} className={`badge-tile ${b.earned ? "is-earned" : ""}`}>
                <span aria-hidden="true">{b.earned ? <Sparkles size={20} /> : <Sparkles size={20} />}</span>
                <strong>{b.name}</strong>
                <small>{b.blurb}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Recent points</h2>
          {j.events.length === 0 && <p className="hint">Learn a lesson or answer a quiz to earn your first points.</p>}
          <ul className="pts-list">
            {j.events.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span className="grow">
                  <strong>{e.label}</strong>
                  <small>{relativeTime(e.ts)}</small>
                </span>
                <span className="pts-plus">+{e.points}</span>
              </li>
            ))}
          </ul>
          <details className="how-points">
            <summary>How points work</summary>
            <p>Lesson from a question 20 · course lesson 30 · quiz answer 5 (2 on a retry) · section quiz 40 · final quiz 80 · finishing a course 150 · certificate 25 · first learning of the day 10 · sharing 5.</p>
          </details>
        </section>
      </div>
    </>
  );
}
