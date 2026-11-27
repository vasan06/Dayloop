import { useState } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, Check, NotebookPen, Repeat, TimerReset, Wallet } from "lucide-react";
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
        <div className="welcome-nav-actions"><button className="btn ghost" onClick={onSignIn}>Sign in</button><button className="btn pri" onClick={onSignUp}>Start free</button></div>
      </nav>

      <main className="welcome-main">
        <header>
          <div className="welcome-kicker">YOUR DAY, CONNECTED</div>
          <h1>Plan less.<br />Move more.</h1>
          <p>Tasks, habits, notes, calendar and personal finance in one workspace that makes progress visible.</p>
          <div className="welcome-cta"><button className="btn pri" onClick={onSignUp}>Create your workspace <ArrowUpRight aria-hidden="true" /></button><a className="btn ghost" href="#workspace">See the workspace</a></div>
          <div className="welcome-proof"><span><b>1</b> workspace</span><span><b>6+</b> connected tools</span><span><b>0</b> tab chaos</span></div>
        </header>

        <section className="planner-preview" aria-label="Interactive sample planner">
          <div className="planner-binding" aria-hidden="true" />
          <div className="planner-frame">
            <div className="planner-preview-bar">
              <span className="planner-preview-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="mono">LIVE DAY</span>
            </div>
            <div className="planner-page">
              <div className="planner-date"><CalendarDays size={17} /> {date}</div>
              <div className="planner-topline"><h2>Today</h2><span>72% on track</span></div>
              <div className="planner-heading"><h3>Priority tasks</h3><span aria-live="polite">{completed.filter(Boolean).length} of 3 done</span></div>
              <ul>{sampleTasks.map((title, index) => (
                <li key={title}><button aria-pressed={completed[index]} onClick={() => setCompleted((current) => current.map((done, i) => i === index ? !done : done))}>
                  <span className="planner-check">{completed[index] && <Check size={15} />}</span><span>{title}</span>
                </button></li>
              ))}</ul>
              <div className="planner-mini-grid">
                <div><Repeat /><span><b>4/5</b><small>habits checked</small></span></div>
                <div><TimerReset /><span><b>3</b><small>tasks today</small></span></div>
              </div>
              <div className="planner-appointment"><time>14:30</time><div><b>Design review</b><small>Calendar · 45 minutes</small></div><span className="planner-appointment-tag">45m</span></div>
            </div>
          </div>
        </section>
      </main>

      <section className="welcome-band" id="workspace">
        <div><span className="mono">ONE LOOP</span><h2>Everything updates the same picture of your day.</h2></div>
        <p>Finish a task, check in a habit, plan an event or record spending. DayLoop keeps those signals together instead of scattering them across separate apps.</p>
      </section>

      <section className="welcome-tools" aria-label="Workspace features">
        <article className="feature-wide"><Repeat /><h2>Habits + streaks</h2><p>Track positive and avoidance habits, expand heatmaps only when you need them, and compare individual streaks.</p></article>
        <article><NotebookPen /><h2>Notes</h2><p>Long-form block writing with slash commands and automatic saving.</p></article>
        <article><Wallet /><h2>Finance</h2><p>Record income and expenses, then compare trends and budgets.</p></article>
        <article><BarChart3 /><h2>Analytics</h2><p>Interactive charts across tasks, habits and money.</p></article>
      </section>

      <section className="welcome-final">
        <div><span className="mono">READY WHEN YOU ARE</span><h2>Build a calmer system for the things you already do.</h2></div>
        <button className="btn pri" onClick={onSignUp}>Create your DayLoop <ArrowUpRight /></button>
      </section>
    </div>
  );
}
