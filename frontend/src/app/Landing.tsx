import { ArrowUpRight, CheckSquare, FolderKanban, NotebookPen, Repeat, Wallet, CalendarDays, BarChart3 } from "lucide-react";
import { Logo } from "../components/Shell";

const FEATURES = [
  { icon: CheckSquare, label: "Tasks" }, { icon: Repeat, label: "Habits" }, { icon: Wallet, label: "Finance" },
  { icon: NotebookPen, label: "Notes" }, { icon: CalendarDays, label: "Calendar" }, { icon: FolderKanban, label: "Projects" }, { icon: BarChart3, label: "Analytics" },
];

export default function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div className="land enter">
      <nav className="lnav" aria-label="Site"><Logo light={false} />
        <a className="lk" href="#features">Features</a><a className="lk" href="#how">How it works</a>
        <button className="lk" onClick={onSignIn}>Sign in</button><button className="btn pri sm" onClick={onSignUp}>Get started</button></nav>
      <header className="lh">
        <div>
          <div className="mono">Tasks · Habits · Money · Notes</div>
          <h1 style={{ marginTop: 12 }}>Run your whole life from <span className="stk">one loop</span>.</h1>
          <p className="lead">DayLoop brings your tasks, habits, spending, notes and calendar into a single calm workspace — so the day makes sense at a glance.</p>
          <div className="row wrap"><button className="btn acc" onClick={onSignUp}>Start free<ArrowUpRight className="ic go" /></button><button className="btn" onClick={onSignIn}>I have an account</button></div>
        </div>
        <div className="wgs" aria-hidden="true">
          <div className="wg" style={{ left: "2%", top: "4%", width: 230, ["--r" as string]: "-3deg" }}><div className="mono">Today</div><div className="big">4 / 6</div><div className="pbar"><i style={{ width: "66%" }} /></div></div>
          <div className="wg tn-mint" style={{ right: "2%", top: "16%", width: 200, ["--r" as string]: "3deg", animationDelay: "-2s" }}><div className="mono">Streak</div><div className="big">12 days</div></div>
          <div className="wg tn-butter" style={{ left: "16%", bottom: "6%", width: 250, ["--r" as string]: "2deg", animationDelay: "-4s" }}><div className="mono">Net this month</div><div className="big">₹18,400</div></div>
        </div>
      </header>
      <div className="mq" aria-hidden="true"><div>{[...FEATURES, ...FEATURES, ...FEATURES, ...FEATURES].map((f, i) => <span key={i}><f.icon className="ic" />{f.label}</span>)}</div></div>
      <section className="sec" id="features"><h2>Everything in one rhythm</h2>
        <div className="g">
          <div className="card tn-butter s7"><h3>Plan the day</h3><p>Tasks with priorities, due dates and subtasks — grouped into projects with live progress.</p></div>
          <div className="card tn-mint s5"><h3>Build streaks</h3><p>Check in daily and watch consistency climb.</p></div>
          <div className="card tn-sky s5"><h3>Know your money</h3><p>Log spending, set budgets and see where it goes.</p></div>
          <div className="card tn-lilac s7"><h3>Think and write</h3><p>Notes that autosave, searchable from anywhere with ⌘K.</p></div>
        </div></section>
      <section className="sec" id="how"><h2>Up and running in three steps</h2>
        <div className="steps">{[["01", "Create your account", "Sign up in seconds and set up your profile."], ["02", "Capture everything", "Add tasks, habits, transactions and notes."], ["03", "See the loop", "A dashboard that shows what matters next."]].map(([n, t, d]) => <div className="card" key={n}><b className="n">{n}</b><h3>{t}</h3><p className="mute">{d}</p></div>)}</div></section>
      <section className="cta"><h2>Make room for what matters.</h2><button className="btn acc" onClick={onSignUp}>Create your workspace<ArrowUpRight className="ic go" /></button></section>
      <footer className="foot2"><span>© {new Date().getFullYear()} DayLoop</span><span>Built for people who like their days to flow.</span></footer>
    </div>
  );
}
