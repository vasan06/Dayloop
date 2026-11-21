import { useState } from "react";
import { ArrowUpRight, CalendarDays, Check, NotebookPen, Wallet } from "lucide-react";
import { Logo } from "../components/Shell";
import "../styles/landing.css";

const sampleTasks = ["Review the first draft", "Send meeting notes", "Book a swim lane"];

export default function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [completed, setCompleted] = useState([false, true, false]);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="welcome">
      <nav className="welcome-nav" aria-label="Site navigation">
        <Logo light={false} />
        <button className="btn ghost" onClick={onSignIn}>Sign in</button>
      </nav>
      <main className="welcome-main">
        <header>
          <h1>Your day,<br />in one place.</h1>
          <p>Plan the next task, keep your habits going, and see where your money went. Your notes and calendar live here too.</p>
          <button className="btn pri" onClick={onSignUp}>Create your workspace <ArrowUpRight aria-hidden="true" /></button>
        </header>
        <section className="planner-preview" aria-label="Interactive sample planner">
          <div className="planner-binding" aria-hidden="true" />
          <div className="planner-page">
            <div className="planner-date"><CalendarDays size={17} /> {date}</div>
            <h2>Daily planner</h2>
            <div className="planner-heading"><h3>Task list</h3><span aria-live="polite">{completed.filter(Boolean).length} of 3 done</span></div>
            <ul>{sampleTasks.map((title, index) => (
              <li key={title}><button aria-pressed={completed[index]} onClick={() => setCompleted((current) =>
                current.map((done, i) => i === index ? !done : done))}>
                <span className="planner-check">{completed[index] && <Check size={15} />}</span>{title}
              </button></li>
            ))}</ul>
            <div className="planner-appointment"><time>14:30</time><div><b>Design review</b><small>Calendar · 45 minutes</small></div></div>
          </div>
        </section>
      </main>
      <section className="welcome-tools" aria-label="Workspace features">
        <article><CalendarDays /><h2>Projects &amp; habits</h2><p>Break projects into tasks and check in on recurring habits.</p></article>
        <article><NotebookPen /><h2>Notes</h2><p>Keep meeting notes, lists and ideas in searchable pages.</p></article>
        <article><Wallet /><h2>Personal finance</h2><p>Record income and expenses, then compare spending with your budget.</p></article>
      </section>
    </div>
  );
}
