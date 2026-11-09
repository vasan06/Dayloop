import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, CheckSquare, ChevronDown,
  ChevronLeft, ChevronRight, Command, CreditCard, FileText, Flame, FolderKanban,
  LayoutDashboard, LogOut, Moon, MoreHorizontal, PanelLeft, Plus, Repeat2, Search,
  Settings, Sun, Trash2, UserRound, WalletCards, X,
} from 'lucide-react';
import './styles.css';
import type { Habit, Note, Page, Project, Task, Transaction } from './types';

type Route = Page;
type EventItem = { id: string; title: string; date: string; time: string };
type Data = { tasks: Task[]; projects: Project[]; habits: Habit[]; transactions: Transaction[]; notes: Note[]; events: EventItem[]; budgets: Record<string, number>; profile: { name: string; email: string; currency: string; weekStarts: string } };
type ModalState = { kind: 'form'; entity: 'task' | 'project' | 'habit' | 'transaction' | 'budget' | 'note' | 'event'; id?: string; projectId?: string } | { kind: 'delete'; entity: 'task' | 'project' | 'habit' | 'transaction' | 'note' | 'account'; id?: string };
type FormEntity = 'task' | 'project' | 'habit' | 'transaction' | 'budget' | 'note' | 'event';

const STORAGE_KEY = 'dayloop-react-v1';
const toISODate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const TODAY = toISODate(new Date());
const NAV: { route: Route; label: string; icon: React.ElementType }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'tasks', label: 'Tasks', icon: CheckSquare },
  { route: 'projects', label: 'Projects', icon: FolderKanban },
  { route: 'habits', label: 'Habits', icon: Repeat2 },
  { route: 'finance', label: 'Finance', icon: WalletCards },
  { route: 'notes', label: 'Notes', icon: FileText },
  { route: 'calendar', label: 'Calendar', icon: CalendarDays },
  { route: 'analytics', label: 'Analytics', icon: Activity },
  { route: 'settings', label: 'Profile & settings', icon: UserRound },
];
const COLORS = ['#2B4CFF', '#F29A1F', '#12A366', '#8B5CF6', '#E5484D'];
const CATEGORIES = ['Rent', 'Food', 'Transport', 'Health', 'Other'];
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toISODate(next);
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmtDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const inr = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

function createInitialData(): Data {
  const projects: Project[] = [
    { id: 'p1', name: 'Major Project', desc: 'Design, build, report and present the final year software systems project.', deadline: addDays(TODAY, 26), status: 'active', color: COLORS[0] },
    { id: 'p2', name: 'Exam Prep', desc: 'Revision plan and mock tests for the semester exams.', deadline: addDays(TODAY, 16), status: 'active', color: COLORS[1] },
    { id: 'p3', name: 'Personal', desc: 'Bills, travel and home errands.', deadline: addDays(TODAY, 45), status: 'active', color: COLORS[2] },
    { id: 'p4', name: 'Portfolio Site', desc: 'Showcase projects and internship work.', deadline: addDays(TODAY, 70), status: 'planned', color: COLORS[3] },
    { id: 'p5', name: 'Internship Wrap-up', desc: 'Handover and feedback after the internship.', deadline: addDays(TODAY, -10), status: 'completed', color: COLORS[4] },
  ];
  const taskSeed: Omit<Task, 'id' | 'due'>[] = [
    { title: 'Finalise DBMS project report', desc: 'Merge the ER diagram, normalisation steps and test results into one PDF.', priority: 'high', projectId: 'p1', status: 'doing' },
    { title: 'Review API authentication flow', desc: 'Check token expiry handling and the refresh flow.', priority: 'high', projectId: 'p1', status: 'todo' },
    { title: 'Prepare viva presentation slides', desc: '12 slides max. Architecture, demo and learnings.', priority: 'med', projectId: 'p1', status: 'todo' },
    { title: 'Submit internship feedback form', desc: 'HR portal form, needs mentor sign-off.', priority: 'med', projectId: '', status: 'todo' },
    { title: 'Pay electricity bill', desc: '', priority: 'low', projectId: 'p3', status: 'todo' },
    { title: 'Book train tickets for Pongal', desc: 'Booking window opens 60 days ahead.', priority: 'med', projectId: 'p3', status: 'todo' },
    { title: 'Revise operating systems notes', desc: 'Scheduling, deadlocks and paging.', priority: 'med', projectId: 'p2', status: 'doing' },
    { title: 'Solve 5 DSA problems', desc: '', priority: 'med', projectId: 'p2', status: 'done' },
    { title: 'Set up CI pipeline', desc: '', priority: 'high', projectId: 'p1', status: 'done' },
    { title: 'Email mentor about thesis topic', desc: '', priority: 'low', projectId: 'p1', status: 'done' },
    { title: 'Clean up room and desk', desc: '', priority: 'low', projectId: 'p3', status: 'todo' },
    { title: 'Mock test: Computer Networks', desc: 'Timed, 90 minutes.', priority: 'high', projectId: 'p2', status: 'todo' },
    { title: 'Draft portfolio wireframes', desc: '', priority: 'med', projectId: 'p4', status: 'todo' },
    { title: 'Collect project screenshots', desc: '', priority: 'low', projectId: 'p4', status: 'todo' },
    { title: 'Hand over documentation', desc: '', priority: 'med', projectId: 'p5', status: 'done' },
    { title: 'Complete exit survey', desc: '', priority: 'low', projectId: 'p5', status: 'done' },
  ];
  return {
    projects,
    tasks: taskSeed.map((task, index) => ({ ...task, id: `t${index + 1}`, due: addDays(TODAY, [-1, 0, 4, -2, 2, 6, 1, 0, -3, -1, 8, 9, 44, 46, -18, -16][index]) })),
    habits: ['Morning run', 'Read 20 pages', 'Code for 1 hour', 'Drink 2.5 L water', 'Sleep by 11 pm'].map((name, index) => {
      const checks = Array.from({ length: 35 }, (_, day) => (day + index * 2) % (index + 3) !== 0 || day > 28 ? addDays(TODAY, day - 34) : '');
      return { id: `h${index + 1}`, name, icon: ['R', 'B', 'C', 'W', 'Z'][index], checks: checks.filter(Boolean), streak: [12, 5, 8, 4, 17][index] };
    }),
    transactions: [
      { id: 'x1', type: 'in', title: 'Salary', category: 'Income', amount: 64000, date: addDays(TODAY, -8) },
      { id: 'x2', type: 'in', title: 'Freelance web project', category: 'Income', amount: 14000, date: addDays(TODAY, -6) },
      { id: 'x3', type: 'out', title: 'Rent', category: 'Rent', amount: 22000, date: addDays(TODAY, -8) },
      { id: 'x4', type: 'out', title: 'Lunch with team', category: 'Food', amount: 1800, date: addDays(TODAY, -3) },
      { id: 'x5', type: 'out', title: 'Metro card', category: 'Transport', amount: 1200, date: addDays(TODAY, -2) },
      { id: 'x6', type: 'out', title: 'Groceries', category: 'Food', amount: 3200, date: addDays(TODAY, -1) },
      { id: 'x7', type: 'out', title: 'Internet bill', category: 'Other', amount: 999, date: addDays(TODAY, -1) },
    ],
    notes: [
      { id: 'n1', title: 'Project ideas', body: 'Keep the first version focused on the daily workflow.\\n\\n- A quick capture flow\\n- A clear next action\\n- A weekly review with useful metrics', date: addDays(TODAY, -2), projectId: 'p1' },
      { id: 'n2', title: 'Reading list', body: 'Books and articles to come back to this month.', date: addDays(TODAY, -5), projectId: 'p2' },
      { id: 'n3', title: 'Weekend plan', body: 'Book the train, finish the laundry and leave an hour for a long walk.', date: TODAY, projectId: 'p3' },
    ],
    events: [
      { id: 'e1', title: 'Project check-in', date: addDays(TODAY, 1), time: '10:30' },
      { id: 'e2', title: 'Mentor meeting', date: addDays(TODAY, 3), time: '14:00' },
      { id: 'e3', title: 'Submit report draft', date: addDays(TODAY, 7), time: '17:00' },
    ],
    budgets: { Rent: 24000, Food: 12000, Transport: 5000, Health: 4000, Other: 6000 },
    profile: { name: 'Keerthivasan R', email: 'keerthivasan22860@gmail.com', currency: 'INR (₹)', weekStarts: 'Monday' },
  };
}

function readData(): Data {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createInitialData();
  try {
    return { ...createInitialData(), ...JSON.parse(stored) as Partial<Data> };
  } catch (error) {
    console.warn('DayLoop saved workspace data could not be read; starting with sample data.', error);
    return createInitialData();
  }
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button className={`icon-btn ${className}`} type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
function Button({ children, onClick, variant = 'default', className = '', type = 'button' }: { children: React.ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'white'; className?: string; type?: 'button' | 'submit' }) {
  return <button type={type} onClick={onClick} className={`btn ${variant} ${className}`}>{children}</button>;
}
function Card({ children, className = '', title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode; key?: React.Key }) {
  return <section className={`card ${className}`}>{title && <div className="card-head"><h2>{title}</h2>{action}</div>}{children}</section>;
}
function PageTitle({ eyebrow = 'DAYLOOP / WORKSPACE', title, subtitle, action, onAction }: { eyebrow?: string; title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="mute">{subtitle}</p></div>{action && <Button variant="primary" onClick={onAction}><Plus size={17} />{action}</Button>}</div>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty"><div className="empty-art"><FileText size={28} /></div><h3>{title}</h3><p className="mute">{text}</p>{action}</div>;
}
function Progress({ value, color }: { value: number; color?: string }) {
  return <div className="progress" role="progressbar" aria-valuenow={Math.min(100, value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>;
}
function Metric({ label, value, note, color = 'blue', spark = [34, 52, 45, 70, 56, 82, 72] }: { label: string; value: React.ReactNode; note: string; color?: string; spark?: number[] }) {
  return <Card className={`metric tile-${color}`}><div className="metric-label"><span className="mono">{label}</span><span className="pill">{note}</span></div><div className="metric-value">{value}</div><Sparkline points={spark} /></Card>;
}
function Sparkline({ points, color = 'currentColor' }: { points: number[]; color?: string }) {
  const max = Math.max(...points, 1); const min = Math.min(...points, 0);
  const coords = points.map((point, index) => `${index * 100 / (points.length - 1)},${30 - (point - min) / Math.max(max - min, 1) * 25}`);
  return <svg className="sparkline" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function BarChart({ values, labels, color = 'var(--acc)' }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...values, 1);
  return <div className="bar-chart" role="img" aria-label="Bar chart">{values.map((value, index) => {
    const height = Math.max(4, value / max * 100);
    return <div className="bar-col" key={`${labels[index]}-${index}`} style={{ '--bar-height': `${height}%` } as React.CSSProperties}><span className="bar-value">{value}</span><i style={{ height: `${height}%`, background: index === values.length - 1 ? color : undefined }} /><span className="bar-label">{labels[index]}</span></div>;
  })}</div>;
}
function TrendChart({ values, labels, color = 'var(--acc)' }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const points = values.map((value, index) => `${24 + index * 560 / Math.max(1, values.length - 1)},${190 - (value - min) / Math.max(max - min, 1) * 150}`);
  return <svg className="trend-chart" viewBox="0 0 610 230" role="img" aria-label="Trend chart">
    {[40, 78, 116, 154, 192].map(y => <line key={y} x1="24" x2="590" y1={y} y2={y} className="chart-grid" />)}
    <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {points.map((point, index) => <circle key={point} cx={point.split(',')[0]} cy={point.split(',')[1]} r="4" fill="var(--card)" stroke={color} strokeWidth="2" />)}
    {labels.map((label, index) => <text key={`${label}-${index}`} x={24 + index * 560 / Math.max(1, labels.length - 1)} y="220" textAnchor="middle">{label}</text>)}
  </svg>;
}
function Donut({ values, colors, center, label }: { values: number[]; colors: string[]; center: string; label: string }) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const radius = 44; const circumference = 2 * Math.PI * radius; let offset = 0;
  return <div className="donut-wrap"><svg className="donut" viewBox="0 0 120 120" role="img" aria-label={`${label}: ${center}`}><circle cx="60" cy="60" r={radius} fill="none" stroke="var(--track)" strokeWidth="12" />{values.map((value, index) => {
    const length = value / total * circumference; const dash = `${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`;
    const segment = <circle key={index} cx="60" cy="60" r={radius} fill="none" stroke={colors[index % colors.length]} strokeWidth="12" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
    offset += length; return segment;
  })}<text x="60" y="58" textAnchor="middle" className="donut-center">{center}</text><text x="60" y="74" textAnchor="middle" className="donut-label">{label}</text></svg></div>;
}
function Gauge({ value, label, color = 'var(--acc)' }: { value: number; label: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return <div className="gauge"><svg viewBox="0 0 120 84" role="img" aria-label={`${pct}% ${label}`}><path d="M12 68A48 48 0 0 1 108 68" pathLength="100" className="gauge-track" /><path d="M12 68A48 48 0 0 1 108 68" pathLength="100" className="gauge-value" style={{ stroke: color, strokeDashoffset: `${100 - pct}` }} /><text x="60" y="59" textAnchor="middle" className="gauge-number">{pct}%</text><text x="60" y="77" textAnchor="middle" className="gauge-label">{label}</text></svg></div>;
}
function Heatmap({ days = 35, active }: { days?: number; active?: (date: string) => boolean }) {
  const dates = Array.from({ length: days }, (_, index) => addDays(TODAY, index - days + 1));
  const leading = new Date(`${dates[0]}T12:00:00`).getDay();
  return <><div className="heatmap-week">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="heatmap">{Array.from({ length: leading }, (_, index) => <i className="heat-blank" key={`blank-${index}`} />)}{dates.map((date, index) => <i key={date} title={`${fmtDate(date)}${active?.(date) ? ' · complete' : ''}`} className={`heat-cell heat-${active?.(date) ? 4 : (index * 7 + 3) % 4}`} />)}</div><div className="heat-legend"><span>{fmtDate(dates[0])} to {fmtDate(dates[dates.length - 1])}</span><span>Less <i /> More</span></div></>;
}
function TaskRow({ task, projectName, onToggle, onOpen, compact = false }: { task: Task; projectName?: string; onToggle: () => void; onOpen: () => void; compact?: boolean; key?: React.Key }) {
  return <div className={`task-row ${task.status === 'done' ? 'is-done' : ''}`}>
    <button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} onClick={onToggle} aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}>{task.status === 'done' && <Check size={14} />}</button>
    <button className="task-main" onClick={onOpen}><b>{task.title}</b>{!compact && task.desc && <span className="mute sm">{task.desc}</span>}{compact && <span className="sm mute">{projectName || 'No project'} · {fmtDate(task.due)}</span>}</button>
    {!compact && <><span className={`pill priority-${task.priority}`}>{task.priority}</span><span className="sm mute task-date">{fmtDate(task.due)}</span><button className="row-more" aria-label="Task options"><MoreHorizontal size={17} /></button></>}
  </div>;
}
function AuthPage({ mode, onMode, onLogin, profileName }: { mode: 'signin' | 'signup' | 'forgot' | 'reset'; onMode: (route: Route) => void; onLogin: (name: string, email: string) => void; profileName: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const isSignup = mode === 'signup';
  const title = mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Make your account.' : mode === 'forgot' ? submitted ? 'Check your inbox.' : 'Forgot your password?' : 'Set a new password.';
  const subtitle = mode === 'signin' ? 'Sign in to pick up where you left off.' : mode === 'signup' ? 'Free for personal use. Takes a minute.' : mode === 'forgot' ? 'Enter your email and we will send a reset link.' : 'Pick something you have not used before.';
  return <main className="auth-page"><section className="auth-form">
    <a className="brand auth-brand" href="#landing"><span className="brand-mark">D</span>DayLoop</a>
    {mode === 'forgot' && submitted ? <div className="auth-success"><span className="success-icon"><Check size={22} /></span><h1>{title}</h1><p>{subtitle}</p><Button variant="primary" onClick={() => onMode('reset')}>Open reset link <ArrowUpRight size={16} /></Button></div> : <form onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (mode === 'forgot') { setSubmitted(true); return; }
      if (mode === 'reset') {
        if (form.get('password') !== form.get('confirm')) { setFormError('Passwords do not match. Type the same password in both fields.'); return; }
        onMode('signin'); return;
      }
      onLogin(String(form.get('name') || profileName), String(form.get('email') || ''));
    }}>
      <p className="eyebrow">YOUR SPACE, IN SYNC</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
      {isSignup && <Field label="Full name"><input name="name" required defaultValue="" placeholder="Your name" /></Field>}
      <Field label="Email"><input name="email" type="email" required defaultValue={mode === 'signin' ? 'keerthivasan22860@gmail.com' : ''} placeholder="you@example.com" /></Field>
      {mode !== 'forgot' && <Field label={mode === 'reset' ? 'New password' : 'Password'}><div className="password-field"><input name="password" type={visible ? 'text' : 'password'} required minLength={8} defaultValue={mode === 'signin' ? 'demo-password' : ''} placeholder={isSignup ? 'At least 8 characters' : ''} /><button type="button" onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></div></Field>}
      {mode === 'reset' && <Field label="Confirm password"><input type={visible ? 'text' : 'password'} name="confirm" required minLength={8} /></Field>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      {mode === 'signin' && <div className="row between auth-options"><label className="row sm"><input type="checkbox" defaultChecked /> Keep me signed in</label><a className="link-accent" href="#forgot">Forgot password?</a></div>}
      <Button type="submit" variant="primary" className="auth-submit">{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'} <ArrowUpRight size={16} /></Button>
      <p className="auth-switch">{mode === 'signin' ? <>New here? <a href="#signup">Create an account</a></> : mode === 'signup' ? <>Already registered? <a href="#signin">Sign in</a></> : <a href="#signin">Back to sign in</a>}</p>
    </form>}
  </section><aside className="auth-art"><div className="auth-orbit"><div className="auth-sample-card"><span className="mono">TODAY</span><h3>Make space for what matters.</h3><div className="sample-line"><span className="task-check checked"><Check size={14} /></span>Plan the week</div><div className="sample-line"><span className="task-check" />30 minute deep work</div><div className="sample-line"><span className="task-check" />Evening reflection</div></div><div className="auth-streak"><Flame size={18} /><b>7 day streak</b><span>Keep the loop going</span></div><div className="auth-tip">Press <kbd>Ctrl K</kbd> anywhere to jump to a page or create something.</div></div></aside></main>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function LandingPage({ data }: { data: Data }) {
  const remaining = data.tasks.filter(task => task.status !== 'done').slice(0, 3);
  return <div className="landing">
    <nav className="landing-nav"><a className="brand" href="#landing"><span className="brand-mark">D</span>DayLoop</a><div className="landing-links"><a href="#features">Features</a><a href="#how">How it works</a><a className="nav-signin" href="#signin">Sign in</a><Button variant="primary" onClick={() => { location.hash = 'signup'; }}>Start free <ArrowUpRight size={15} /></Button></div></nav>
    <section className="landing-hero"><div className="landing-copy"><p className="mono">TASKS · HABITS · MONEY · NOTES</p><h1>Your whole week<br />in one <em>calm</em> place.</h1><p>DayLoop puts your tasks, projects, habits, budget, notes and calendar side by side, so you can see how the week is really going.</p><div className="row wrap"><Button variant="primary" onClick={() => { location.hash = 'signup'; }}>Create free account <ArrowUpRight size={16} /></Button><a className="btn" href="#signin">Sign in</a></div><span className="sm mute landing-caption">Free for personal use. No card needed.</span></div>
      <div className="landing-preview"><div className="preview-orbit orbit-one" /><div className="preview-orbit orbit-two" /><div className="preview-card preview-tasks"><div className="row between"><b>Today</b><span className="pill blue">{remaining.length} tasks</span></div>{remaining.map(task => <div className="sample-line" key={task.id}><span className="task-check" />{task.title}</div>)}</div><div className="preview-card preview-streak"><div className="mono">STREAK</div><div className="row"><Gauge value={80} label="week" color="var(--ink)" /><b>5 days</b></div></div><div className="preview-card preview-score"><div className="row between"><b>Productivity</b><span className="pill ok">+12%</span></div><TrendChart values={[38, 48, 42, 63, 55, 74, 67, 87]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S', '']} /></div><div className="preview-card preview-saved"><span className="mono">SAVED, 30 DAYS</span><div className="metric-value">{inr(18500)}</div><Progress value={72} color="var(--ink)" /></div></div>
    </section>
    <div className="marquee"><div>{[...NAV.slice(1, 8), ...NAV.slice(1, 8)].map((item, index) => <span key={`${item.route}-${index}`}><item.icon size={16} />{item.label}</span>)}</div></div>
    <section id="features" className="landing-section"><p className="eyebrow">ONE CALM WORKSPACE</p><h2>Everything you plan, in one view.</h2><div className="feature-grid">
      <Card className="span-7 tile-butter" title="Tasks"><h3 className="feature-title">Deadlines you can see coming.</h3>{remaining.map(task => <div className="sample-line" key={task.id}><span className="task-check" />{task.title}</div>)}</Card>
      <Card className="span-5 feature-dark" title="Projects"><h3 className="feature-title">Progress that rolls up on its own.</h3><div className="project-rings">{data.projects.slice(0, 3).map((project, index) => <div key={project.id}><Gauge value={[62, 48, 78][index]} label={project.name.split(' ')[0]} color={project.color} /></div>)}</div></Card>
      <Card className="span-4 tile-lilac" title="Habits"><h3>Streaks, as a heatmap.</h3><Heatmap active={date => data.habits.some(habit => habit.checks.includes(date))} /></Card>
      <Card className="span-4 tile-mint" title="Money"><h3>Budgets that talk back.</h3><div className="row"><Donut values={[36, 25, 16, 13, 10]} colors={COLORS} center={inr(27800)} label="spent" /><div className="sm">Track income, spending and monthly budgets together.</div></div></Card>
      <Card className="span-4 tile-sky" title="Command palette"><h3>Jump anywhere with a keystroke.</h3><div className="fake-search"><Search size={16} /> Go to Finance <kbd>Ctrl K</kbd></div><p className="sm mute">Create a task, open a note, or move between pages without losing focus.</p></Card>
      <Card className="span-8" title="Analytics"><h3>Know whether it was a good week.</h3><TrendChart values={[44, 59, 52, 68, 61, 81, 76, 91]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S', '']} /></Card>
      <Card className="span-4 tile-blush" title="Notes and calendar"><h3>Write next to the work.</h3>{data.events.map(event => <div className="timeline-item" key={event.id}><b>{event.title}</b><span className="sm mute">{fmtDate(event.date)} · {event.time}</span></div>)}</Card>
    </div></section>
    <section id="how" className="landing-section how-section"><p className="eyebrow">A SIMPLE LOOP</p><h2>Plan it, do it, look back.</h2><div className="steps">{[['01', 'Capture', 'Add tasks, notes and expenses in seconds from the New menu or the palette.'], ['02', 'Focus', 'Your dashboard names the one thing to do next, so you can just start.'], ['03', 'Review', 'Charts show streaks, spending and completion so next week starts smarter.']].map(([number, title, copy]) => <Card key={number}><span className="mono">{`STEP ${number}`}</span><h3>{title}</h3><p className="mute">{copy}</p></Card>)}</div></section>
    <section className="landing-cta"><h2>Start with one task.</h2><Button variant="accent" onClick={() => { location.hash = 'signup'; }}>Create free account <ArrowUpRight size={16} /></Button></section>
    <footer className="landing-footer"><a className="brand" href="#landing"><span className="brand-mark">D</span>DayLoop</a><span>A design prototype with sample data.</span><a href="#signin">Sign in</a></footer>
  </div>;
}

function App() {
  const [data, setData] = useState<Data>(readData);
  const [route, setRoute] = useState<Route | string>(() => location.hash.slice(1) || 'landing');
  const [authed, setAuthed] = useState(() => localStorage.getItem('dayloop-signed-in') === 'true');
  const [dark, setDark] = useState(() => {
    const preference = localStorage.getItem('dayloop-theme');
    return preference ? preference === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dayloop-rail') === 'collapsed');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [taskTab, setTaskTab] = useState('all');
  const [taskSort, setTaskSort] = useState('due');
  const [taskProjectFilter, setTaskProjectFilter] = useState('');
  const [projectTab, setProjectTab] = useState('active');
  const [transactionTab, setTransactionTab] = useState('all');
  const [range, setRange] = useState('30');
  const [calendarDate, setCalendarDate] = useState(TODAY);
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [selectedNote, setSelectedNote] = useState('n1');
  const [noteQuery, setNoteQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [profileSaved, setProfileSaved] = useState(false);
  const [preferences, setPreferences] = useState([true, true, true]);
  const [sampleState, setSampleState] = useState<Record<string, string>>({});

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('dayloop-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => { localStorage.setItem('dayloop-signed-in', String(authed)); }, [authed]);
  useEffect(() => { localStorage.setItem('dayloop-rail', collapsed ? 'collapsed' : 'expanded'); }, [collapsed]);
  useEffect(() => {
    const changeRoute = () => setRoute(location.hash.slice(1) || 'landing');
    window.addEventListener('hashchange', changeRoute);
    return () => window.removeEventListener('hashchange', changeRoute);
  }, []);
  useEffect(() => {
    if (!authed && !['landing', 'signin', 'signup', 'forgot', 'reset'].includes(route)) location.hash = 'signin';
    else if (authed && (route === 'signin' || route === 'signup')) location.hash = 'dashboard';
  }, [authed, route]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && authed) { event.preventDefault(); setPaletteOpen(value => !value); }
      if (event.key === 'Escape') { setModal(null); setPaletteOpen(false); }
      if (event.key === '/' && authed && !/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)) { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [authed]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currentRoute = route.split('-')[0] as Route;
  const routeId = route.includes('-') ? route.slice(route.indexOf('-') + 1) : '';
  const taskTotals = useMemo(() => ({
    total: data.tasks.length,
    done: data.tasks.filter(task => task.status === 'done').length,
    open: data.tasks.filter(task => task.status !== 'done').length,
    overdue: data.tasks.filter(task => task.status !== 'done' && task.due < TODAY).length,
  }), [data.tasks]);
  const income = data.transactions.filter(item => item.type === 'in').reduce((total, item) => total + item.amount, 0);
  const expenses = data.transactions.filter(item => item.type === 'out').reduce((total, item) => total + item.amount, 0);
  const categorySpend = (category: string) => data.transactions.filter(item => item.type === 'out' && item.category === category).reduce((total, item) => total + item.amount, 0);
  const projectName = (id: string) => data.projects.find(project => project.id === id)?.name || 'No project';

  const navigate = (next: string) => { location.hash = next; setPaletteOpen(false); setSearch(''); };
  const showToast = (message: string) => setToast(message);
  const updateData = (updater: (previous: Data) => Data) => setData(previous => updater(previous));
  const toggleTask = (taskId: string) => updateData(previous => {
    const task = previous.tasks.find(item => item.id === taskId);
    const nextStatus = task?.status === 'done' ? 'todo' : 'done';
    return { ...previous, tasks: previous.tasks.map(item => item.id === taskId ? { ...item, status: nextStatus } : item) };
  });
  const addNew = (entity: FormEntity, projectId?: string) => setModal({ kind: 'form', entity, projectId });
  const openForm = (entity: FormEntity, id?: string) => setModal({ kind: 'form', entity, id });
  const submitForm = (entity: FormEntity, id: string | undefined, form: FormData, projectId?: string) => {
    const value = (key: string) => String(form.get(key) || '');
    const noteId = entity === 'note' ? id || makeId() : '';
    updateData(previous => {
      if (entity === 'task') {
        const existing = previous.tasks.find(item => item.id === id);
        const task: Task = { id: id || makeId(), title: value('title').trim(), desc: value('desc').trim(), due: value('due') || TODAY, priority: (value('priority') || 'med') as Task['priority'], projectId: value('projectId') || projectId || '', status: (value('status') || 'todo') as Task['status'] };
        return { ...previous, tasks: existing ? previous.tasks.map(item => item.id === id ? task : item) : [task, ...previous.tasks] };
      }
      if (entity === 'project') {
        const existing = previous.projects.find(item => item.id === id);
        const project: Project = { id: id || makeId(), name: value('name').trim(), desc: value('desc').trim(), deadline: value('deadline') || addDays(TODAY, 30), status: (value('status') || 'active') as Project['status'], color: existing?.color || COLORS[previous.projects.length % COLORS.length] };
        return { ...previous, projects: existing ? previous.projects.map(item => item.id === id ? project : item) : [project, ...previous.projects] };
      }
      if (entity === 'habit') {
        const existing = previous.habits.find(item => item.id === id);
        const habit: Habit = { id: id || makeId(), name: value('name').trim(), icon: existing?.icon || value('name').trim().slice(0, 1).toUpperCase(), checks: existing?.checks || [], streak: existing?.streak || 0 };
        return { ...previous, habits: existing ? previous.habits.map(item => item.id === id ? habit : item) : [habit, ...previous.habits] };
      }
      if (entity === 'transaction') {
        const transaction: Transaction = { id: id || makeId(), title: value('title').trim(), category: value('category'), amount: Number(value('amount')) || 0, date: value('date') || TODAY, type: value('type') as Transaction['type'] };
        return { ...previous, transactions: id ? previous.transactions.map(item => item.id === id ? transaction : item) : [transaction, ...previous.transactions] };
      }
      if (entity === 'budget') return { ...previous, budgets: { ...previous.budgets, [value('category')]: Number(value('amount')) || 0 } };
      if (entity === 'note') {
        const note: Note = { id: noteId, title: value('title').trim(), body: value('body').trim(), date: id ? previous.notes.find(item => item.id === id)?.date || TODAY : TODAY, projectId: value('projectId') };
        return { ...previous, notes: id ? previous.notes.map(item => item.id === id ? note : item) : [note, ...previous.notes] };
      }
      const event: EventItem = { id: id || makeId(), title: value('title').trim(), date: value('date') || calendarDate, time: value('time') || '09:00' };
      return { ...previous, events: id ? previous.events.map(item => item.id === id ? event : item) : [...previous.events, event] };
    });
    if (entity === 'note') setSelectedNote(noteId);
    setModal(null);
    showToast(id ? 'Changes saved' : `${entity[0].toUpperCase()}${entity.slice(1)} created`);
  };
  const deleteEntity = (entity: 'task' | 'project' | 'habit' | 'transaction' | 'note' | 'account', id?: string) => {
    if (entity === 'account') { setAuthed(false); navigate('landing'); return; }
    updateData(previous => {
      const collection = { task: 'tasks', project: 'projects', habit: 'habits', transaction: 'transactions', note: 'notes' }[entity];
      if (entity === 'project') return { ...previous, projects: previous.projects.filter(item => item.id !== id), tasks: previous.tasks.map(task => task.projectId === id ? { ...task, projectId: '' } : task), notes: previous.notes.map(note => note.projectId === id ? { ...note, projectId: '' } : note) };
      return { ...previous, [collection]: previous[collection].filter((item: { id: string }) => item.id !== id) } as Data;
    });
    setModal(null);
    showToast(`${entity[0].toUpperCase()}${entity.slice(1)} deleted`);
    if (route.startsWith('task-')) navigate('tasks');
    if (route.startsWith('project-')) navigate('projects');
  };
  const login = (name: string, email: string) => {
    updateData(previous => ({ ...previous, profile: { ...previous.profile, name: name || previous.profile.name, email: email || previous.profile.email } }));
    setAuthed(true); navigate('dashboard'); showToast('Signed in');
  };
  const pageAction = (label: string) => {
    const actions: Record<string, FormEntity> = { 'New task': 'task', 'New project': 'project', 'New habit': 'habit', 'Add transaction': 'transaction', 'Add event': 'event', 'New note': 'note', 'Set budgets': 'budget' };
    addNew(actions[label] || 'task');
  };
  const pageHeader = (title: string, subtitle: string, action?: string) => <PageTitle title={title} subtitle={subtitle} action={action} onAction={() => action && pageAction(action)} />;

  const renderTask = (task: Task, compact = false) => <TaskRow key={task.id} task={task} projectName={projectName(task.projectId)} compact={compact} onToggle={() => toggleTask(task.id)} onOpen={() => navigate(`task-${task.id}`)} />;
  const renderDashboard = () => {
    const todayTasks = data.tasks.filter(task => task.due === TODAY && task.status !== 'done');
    const upcoming = data.tasks.filter(task => task.status !== 'done' && task.due >= TODAY).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    const next = data.tasks.filter(task => task.status !== 'done').sort((a, b) => a.due.localeCompare(b.due))[0];
    const checkedHabits = data.habits.filter(habit => habit.checks.includes(TODAY)).length;
    const completion = taskTotals.total ? Math.round(taskTotals.done / taskTotals.total * 100) : 0;
    return <>
      <div className="dashboard-grid">
        <section className="hero span-8"><div className="hero-decoration"><i /><i /><i /></div><div className="hero-copy"><span className="mono">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · YOUR WEEK AT A GLANCE</span><h1>{todayTasks.length ? <><em>{todayTasks.length} thing{todayTasks.length > 1 ? 's' : ''}</em> need your attention.</> : <><em>You're clear</em> to focus on what matters.</>}</h1><p>{todayTasks.length ? `${todayTasks[0].title}${todayTasks.length > 1 ? `, then ${todayTasks[1].title}` : ''}. Everything else can wait.` : 'Plan the week or pick something from the backlog.'}</p><div className="row wrap"><Button variant="accent" onClick={() => navigate('tasks')}>Open tasks <ArrowUpRight size={15} /></Button><Button variant="white" onClick={() => addNew('task')}><Plus size={16} />Quick add</Button></div><div className="hero-chips"><span><b>{taskTotals.done}/{taskTotals.total}</b> tasks done</span><span><b>{data.projects.filter(project => project.status === 'active').length}</b> active projects</span><span><b>{data.habits[1]?.streak || 0}d</b> reading streak</span></div></div><div className="hero-gauges"><Gauge value={todayTasks.length ? Math.round((data.tasks.filter(task => task.due === TODAY && task.status === 'done').length / Math.max(data.tasks.filter(task => task.due === TODAY).length, 1)) * 100) : 100} label="tasks" /><Gauge value={data.habits.length ? Math.round(checkedHabits / data.habits.length * 100) : 0} label="habits" color="var(--amber)" /></div></section>
        <Card className="span-4 next-action tile-accent"><div><span className="mono">NEXT BEST ACTION</span>{next ? <><h2>{next.title}</h2><p>{next.due < TODAY ? 'Overdue since ' : 'Due '}{fmtDate(next.due)} · {projectName(next.projectId)}</p></> : <h2>Nothing pending</h2>}</div>{next && <div className="row wrap"><Button onClick={() => updateData(previous => ({ ...previous, tasks: previous.tasks.map(item => item.id === next.id ? { ...item, status: 'doing' } : item) }))}>{next.status === 'doing' ? 'In progress' : 'Start now'}</Button><Button variant="white" onClick={() => toggleTask(next.id)}><Check size={15} />Mark done</Button></div>}</Card>
        <Metric label="Productivity score" value="81" note="+7" color="butter" spark={[58, 63, 61, 70, 68, 74, 81]} />
        <Metric label="Tasks completed" value={taskTotals.done} note={`${taskTotals.open} left`} color="mint" spark={[3, 4, 2, 5, 4, 6, taskTotals.done]} />
        <Metric label="Habits today" value={<>{checkedHabits}<small>/{data.habits.length}</small></>} note={`${Math.max(0, ...data.habits.map(habit => habit.streak))}d best streak`} color="lilac" />
        <Metric label="Saved, 30 days" value={inr(income - expenses)} note={income ? `${Math.round((income - expenses) / income * 100)}%` : '0%'} color="sky" />
        <Card className="span-7" title="Productivity trend" action={<div className="seg">{['daily', 'weekly', 'monthly'].map(item => <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item}</button>)}</div>}><p className="sm mute">Score out of 100 against your target</p><TrendChart values={range === 'weekly' ? [52, 68, 61, 79, 74, 86, 81] : range === 'monthly' ? [48, 55, 60, 66, 71, 76, 81] : [62, 48, 71, 78, 69, 86, 81]} labels={['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']} /></Card>
        <Card className="span-5 tile-blush" title="Daily completion" action={<span className="pill">GOAL BY 9 PM</span>}><Gauge value={completion} label="of all tasks" color="var(--ink)" /><div className="row between mini-stats"><span><small>Overdue</small><b>{taskTotals.overdue}</b></span><span><small>7 day avg</small><b>76%</b></span><span><small>Best</small><b>100%</b></span></div></Card>
        <Card className="span-4" title="Tasks this week"><BarChart values={[4, 2, 5, 6, 3, 7, taskTotals.done]} labels={['S', 'S', 'M', 'T', 'W', 'T', 'F']} /></Card>
        <Card className="span-4" title="Habit consistency" action={<a className="link-accent sm" href="#habits">All habits</a>}><Heatmap active={date => data.habits.some(habit => habit.checks.includes(date))} /></Card>
        <Card className="span-4" title="Projects" action={<a className="link-accent sm" href="#projects">{data.projects.filter(project => project.status === 'active').length} active</a>}><div className="project-list">{data.projects.filter(project => project.status !== 'completed').map(project => <button key={project.id} className="project-mini" onClick={() => navigate(`project-${project.id}`)}><span className="project-dot" style={{ background: project.color }} /><span><b>{project.name}</b><small>{data.tasks.filter(task => task.projectId === project.id && task.status === 'done').length} of {data.tasks.filter(task => task.projectId === project.id).length} tasks · due {fmtDate(project.deadline)}</small></span><ArrowUpRight size={15} /></button>)}</div></Card>
        <Card className="span-5" title="Today and upcoming" action={<Button className="small" onClick={() => addNew('task')}><Plus size={14} />Add</Button>}>{upcoming.length ? <div className="list">{upcoming.map(task => renderTask(task, true))}</div> : <Empty title="All clear" text="Nothing due today." />}</Card>
        <Card className="span-7" title="Money, 30 days" action={<a className="link-accent sm" href="#finance">Finance</a>}><div className="money-card"><Donut values={CATEGORIES.map(categorySpend)} colors={COLORS} center={inr(expenses)} label="spent" /><div className="money-legend">{CATEGORIES.map((category, index) => <div key={category}><span><i style={{ background: COLORS[index] }} />{category}</span><b>{inr(categorySpend(category))}</b></div>)}</div></div><div className="row between"><span className="sm mute">Budget used</span><b className="sm">{Math.round(expenses / Math.max(Object.values<number>(data.budgets).reduce((sum, amount) => sum + amount, 0), 1) * 100)}%</b></div><Progress value={expenses / Math.max(Object.values<number>(data.budgets).reduce((sum, amount) => sum + amount, 0), 1) * 100} /></Card>
      </div>
    </>;
  };
  const renderTasks = () => {
    const tabs = ['all', 'pending', 'overdue', 'upcoming', 'completed'];
    const tasks = data.tasks.filter(task => {
      const matchTab = taskTab === 'all' || (taskTab === 'pending' && task.status !== 'done') || (taskTab === 'overdue' && task.status !== 'done' && task.due < TODAY) || (taskTab === 'upcoming' && task.status !== 'done' && task.due > TODAY) || (taskTab === 'completed' && task.status === 'done');
      const matchProject = !taskProjectFilter || (taskProjectFilter === 'none' ? !task.projectId : task.projectId === taskProjectFilter);
      return matchTab && matchProject && `${task.title} ${task.desc}`.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => taskSort === 'priority' ? ['high', 'med', 'low'].indexOf(a.priority) - ['high', 'med', 'low'].indexOf(b.priority) : taskSort === 'name' ? a.title.localeCompare(b.title) : a.due.localeCompare(b.due));
    return <>{pageHeader('Tasks', 'Create, prioritise and finish work.', 'New task')}<div className="content-grid"><Card className="span-8"><div className="search-field"><Search size={17} /><input placeholder="Search tasks" value={search} onChange={event => setSearch(event.target.value)} /><kbd>/</kbd></div><div className="tabs">{tabs.map(tab => <button key={tab} onClick={() => setTaskTab(tab)} className={taskTab === tab ? 'on' : ''}>{tab[0].toUpperCase() + tab.slice(1)} <small>{tab === 'all' ? data.tasks.length : tab === 'pending' ? taskTotals.open : tab === 'overdue' ? taskTotals.overdue : tab === 'upcoming' ? data.tasks.filter(task => task.status !== 'done' && task.due > TODAY).length : taskTotals.done}</small></button>)}</div><div className="row wrap filter-row"><select aria-label="Filter by project" value={taskProjectFilter} onChange={event => setTaskProjectFilter(event.target.value)}><option value="">All projects</option><option value="none">No project</option>{data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select aria-label="Sort tasks" value={taskSort} onChange={event => setTaskSort(event.target.value)}><option value="due">Sort by due date</option><option value="priority">Sort by priority</option><option value="name">Sort by name</option></select><Button variant="primary" onClick={() => addNew('task')}><Plus size={16} />New task</Button></div>{tasks.length ? <div className="list">{tasks.map(task => renderTask(task))}</div> : <Empty title="No tasks here" text="Nothing matches this view. Add a task or change the filters." action={<Button variant="primary" onClick={() => addNew('task')}><Plus size={15} />Add a task</Button>} />}</Card><div className="side-stack"><Card className="centered" title="Completion rate"><Gauge value={taskTotals.total ? Math.round(taskTotals.done / taskTotals.total * 100) : 0} label="of all tasks" /><div className="row between"><span className="pill priority-high">{taskTotals.overdue} overdue</span><span className="pill blue">{data.tasks.filter(task => task.status !== 'done' && task.due > TODAY).length} upcoming</span></div></Card><Card title="By status">{(['todo', 'doing', 'done'] as const).map(status => { const count = data.tasks.filter(task => task.status === status).length; return <div className="status-progress" key={status}><div className="row between"><b>{status === 'todo' ? 'To do' : status === 'doing' ? 'In progress' : 'Done'}</b><span className="num">{count}</span></div><Progress value={count / Math.max(taskTotals.total, 1) * 100} color={status === 'done' ? 'var(--green)' : status === 'doing' ? 'var(--amber)' : 'var(--blue)'} /></div>; })}</Card></div></div></>;
  };
  const renderTaskDetails = () => {
    const task = data.tasks.find(item => item.id === routeId);
    if (!task) return <>{pageHeader('Task not found', '')}<Card><Empty title="This task was deleted" text="It may have been removed." action={<Button onClick={() => navigate('tasks')}>Back to tasks</Button>} /></Card></>;
    return <>{<PageTitle eyebrow="TASKS / DETAILS" title={task.title} subtitle="Your next action, with the details close at hand." />}<div className="content-grid"><Card className="span-8"><div className="row wrap"><span className={`pill ${task.status === 'done' ? 'ok' : task.status === 'doing' ? 'priority-med' : 'blue'}`}>{task.status === 'done' ? 'Completed' : task.status === 'doing' ? 'In progress' : 'To do'}</span><span className={`pill priority-${task.priority}`}>{task.priority} priority</span>{task.due < TODAY && task.status !== 'done' && <span className="pill priority-high">Overdue</span>}</div><h3 className="detail-label">Description</h3><p className="detail-description">{task.desc || <span className="mute">No description yet.</span>}</p><div className="detail-grid"><div><span className="sm mute">Due date</span><b>{fmtDate(task.due)}</b></div><div><span className="sm mute">Project</span>{task.projectId ? <a href={`#project-${task.projectId}`} className="link-accent">{projectName(task.projectId)}</a> : <b>None</b>}</div></div><div className="row wrap detail-actions"><Button variant="primary" onClick={() => toggleTask(task.id)}><Check size={16} />{task.status === 'done' ? 'Reopen task' : 'Mark complete'}</Button><Button onClick={() => openForm('task', task.id)}>Edit</Button><Button onClick={() => setModal({ kind: 'delete', entity: 'task', id: task.id })} className="danger-text"><Trash2 size={16} />Delete</Button></div></Card><Card className="span-4" title="Activity"><div className="timeline-item"><b>Created</b><span className="sm mute">{fmtDate(task.due)}</span></div><div className="timeline-item"><b>Priority set to {task.priority}</b><span className="sm mute">Just now</span></div>{task.status === 'done' && <div className="timeline-item"><b>Completed</b><span className="sm mute">Today</span></div>}</Card></div></>;
  };
  const renderProjects = () => {
    const projects = data.projects.filter(project => projectTab === 'all' || project.status === projectTab);
    return <>{pageHeader('Projects', 'Group tasks, deadlines and notes.', 'New project')}<div className="tabs project-tabs">{['active', 'planned', 'completed', 'all'].map(tab => <button key={tab} onClick={() => setProjectTab(tab)} className={projectTab === tab ? 'on' : ''}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>{projects.length ? <div className="project-grid">{projects.map(project => {
      const tasks = data.tasks.filter(task => task.projectId === project.id); const done = tasks.filter(task => task.status === 'done').length;
      return <button key={project.id} className="card project-card" onClick={() => navigate(`project-${project.id}`)}><div className="project-cover" style={{ background: `linear-gradient(135deg, ${project.color}, #0F1014)` }} /><div className="row between"><h2>{project.name}</h2><span className={`pill ${project.status === 'completed' ? 'ok' : 'blue'}`}>{project.status}</span></div><p className="sm mute project-desc">{project.desc}</p><Progress value={done / Math.max(tasks.length, 1) * 100} color={project.color} /><div className="row between sm"><span>{Math.round(done / Math.max(tasks.length, 1) * 100)}% done</span><span className="mute">{done}/{tasks.length} tasks · {fmtDate(project.deadline)}</span></div></button>;
    })}</div> : <Card><Empty title="No projects in this view" text="Create a project to group related tasks and notes." action={<Button variant="primary" onClick={() => addNew('project')}><Plus size={15} />Create project</Button>} /></Card>}</>;
  };
  const renderProjectDetails = () => {
    const project = data.projects.find(item => item.id === routeId);
    if (!project) return <>{pageHeader('Project not found', '')}<Card><Empty title="This project was deleted" text="" action={<Button onClick={() => navigate('projects')}>Back to projects</Button>} /></Card></>;
    const tasks = data.tasks.filter(task => task.projectId === project.id); const done = tasks.filter(task => task.status === 'done').length;
    const notes = data.notes.filter(note => note.projectId === project.id);
    return <><PageTitle eyebrow="PROJECTS / DETAILS" title={project.name} subtitle="A home for the work, deadlines and ideas that belong together." /><section className="project-hero" style={{ background: `linear-gradient(120deg, ${project.color}, #0F1014)` }}><span className="pill translucent">{project.status}</span><p>{project.desc}</p><div className="row wrap"><Button onClick={() => openForm('project', project.id)}>Edit project</Button><Button variant="white" onClick={() => setModal({ kind: 'delete', entity: 'project', id: project.id })}><Trash2 size={15} />Delete</Button></div><div className="project-hero-stat"><b>{Math.round(done / Math.max(tasks.length, 1) * 100)}%</b><span>complete · due {fmtDate(project.deadline)}</span></div></section><div className="content-grid project-details"><Card className="span-8" title="Tasks" action={<Button variant="primary" className="small" onClick={() => addNew('task', project.id)}><Plus size={14} />Add task</Button>}>{tasks.length ? <div className="list">{tasks.map(task => renderTask(task, true))}</div> : <Empty title="No tasks yet" text="Add the first task for this project." />}</Card><Card className="span-4" title="Related notes">{notes.length ? notes.map(note => <button className="note-link" key={note.id} onClick={() => { setSelectedNote(note.id); navigate('notes'); }}><FileText size={16} /><span><b>{note.title}</b><small>{fmtDate(note.date)}</small></span></button>) : <Empty title="No notes linked" text="Add a note and connect it to this project." action={<Button onClick={() => addNew('note', project.id)}>New note</Button>} />}</Card></div></>;
  };
  const renderHabits = () => {
    const checked = data.habits.filter(habit => habit.checks.includes(TODAY)).length;
    const onToggle = (habit: Habit) => updateData(previous => ({ ...previous, habits: previous.habits.map(item => item.id === habit.id ? { ...item, checks: item.checks.includes(TODAY) ? item.checks.filter(date => date !== TODAY) : [...item.checks, TODAY], streak: item.checks.includes(TODAY) ? Math.max(0, item.streak - 1) : item.streak + 1 } : item) }));
    return <>{pageHeader('Habits', 'Small routines, tracked every day.', 'New habit')}<div className="content-grid"><Card className="span-7" title="Today">{data.habits.length ? <div className="list">{data.habits.map(habit => <div className={`habit-row ${habit.checks.includes(TODAY) ? 'is-done' : ''}`} key={habit.id}><button className={`task-check ${habit.checks.includes(TODAY) ? 'checked' : ''}`} onClick={() => onToggle(habit)} aria-label={`Toggle ${habit.name}`}>{habit.checks.includes(TODAY) && <Check size={14} />}</button><span className="habit-icon">{habit.icon}</span><span className="habit-main"><b>{habit.name}</b><span className="habit-dots">{Array.from({ length: 7 }, (_, index) => <i className={habit.checks.includes(addDays(TODAY, index - 6)) ? 'filled' : ''} key={index} />)}<small>{habit.checks.length} check-ins</small></span></span><span className="pill priority-med">{habit.streak} day streak</span><IconButton label="Edit habit" onClick={() => openForm('habit', habit.id)}><Settings size={15} /></IconButton><IconButton label="Delete habit" onClick={() => setModal({ kind: 'delete', entity: 'habit', id: habit.id })}><Trash2 size={15} /></IconButton></div>)}</div> : <Empty title="No habits yet" text="Start with one small routine you can do every day." action={<Button variant="primary" onClick={() => addNew('habit')}><Plus size={15} />Create habit</Button>} />}</Card><Card className="span-5 centered" title="Today's completion"><Gauge value={Math.round(checked / Math.max(data.habits.length, 1) * 100)} label={`${checked} of ${data.habits.length} habits`} color="var(--violet)" /><div className="row between"><span className="sm">Longest streak <b>{Math.max(0, ...data.habits.map(habit => habit.streak))} days</b></span><span className="sm">Best habit <b>{data.habits.slice().sort((a, b) => b.streak - a.streak)[0]?.name || '-'}</b></span></div></Card><Card className="span-7" title="Consistency calendar" action={<span className="sm mute">Last 5 weeks</span>}><Heatmap active={date => data.habits.some(habit => habit.checks.includes(date))} /></Card><Card className="span-5" title="Weekly performance"><BarChart values={Array.from({ length: 7 }, (_, index) => data.habits.filter(habit => habit.checks.includes(addDays(TODAY, index - 6))).length)} labels={['S', 'M', 'T', 'W', 'T', 'F', 'S']} color="var(--violet)" /></Card></div></>;
  };
  const renderFinance = () => {
    const budgetTotal = Object.values<number>(data.budgets).reduce((sum, amount) => sum + amount, 0);
    const byCategory = CATEGORIES.map(categorySpend);
    return <>{pageHeader('Finance', 'Income, spending and budgets, last 30 days.', 'Add transaction')}<div className="row wrap page-shortcuts"><a className="btn" href="#transactions"><CreditCard size={16} />All transactions</a><a className="btn" href="#budgets"><Activity size={16} />Budgets</a></div><div className="dashboard-grid finance-grid"><Metric label="Income" value={inr(income)} note="30 DAYS" color="mint" /><Metric label="Expenses" value={inr(expenses)} note="30 DAYS" color="blush" /><Metric label="Saved" value={inr(income - expenses)} note={income ? `${Math.round((income - expenses) / income * 100)}% of income` : '0%'} color="butter" /><Metric label="Budget remaining" value={inr(budgetTotal - expenses)} note={`of ${inr(budgetTotal)}`} color="sky" /><Card className="span-8" title="Income vs expenses" action={<span className="sm mute">Monthly trend</span>}><TrendChart values={[47000, 54000, 63000, income, 58000, 65000, 72000]} labels={['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']} color="var(--green)" /></Card><Card className="span-4" title="Spending breakdown"><div className="money-card"><Donut values={byCategory} colors={COLORS} center={inr(expenses)} label="spent" /><div className="money-legend">{CATEGORIES.map((category, index) => <div key={category}><span><i style={{ background: COLORS[index] }} />{category}</span><b>{Math.round(categorySpend(category) / Math.max(expenses, 1) * 100)}%</b></div>)}</div></div></Card><Card className="span-7" title="Where the money went" action={<span className="sm mute">Income sources to categories and savings</span>}><div className="flow-chart"><span>Income <b>{inr(income)}</b></span><i /><span>Expenses <b>{inr(expenses)}</b></span><i /><span>Savings <b>{inr(income - expenses)}</b></span></div><div className="money-legend horizontal">{CATEGORIES.map(category => <div key={category}><span>{category}</span><b>{inr(categorySpend(category))}</b></div>)}</div></Card><Card className="span-5" title="Weekly spending"><BarChart values={data.transactions.filter(item => item.type === 'out').slice(0, 7).map(item => item.amount)} labels={data.transactions.filter(item => item.type === 'out').slice(0, 7).map(item => fmtDate(item.date))} color="var(--amber)" /></Card><Card className="span-4" title="Cashflow heatmap"><Heatmap active={date => data.transactions.some(item => item.date === date)} /></Card><Card className="span-4" title="Budget utilisation" action={<a href="#budgets" className="link-accent sm">Edit</a>}>{CATEGORIES.map(category => <div className="status-progress" key={category}><div className="row between"><b>{category}</b><span className="num">{Math.round(categorySpend(category) / Math.max(data.budgets[category] || 1, 1) * 100)}%</span></div><Progress value={categorySpend(category) / Math.max(data.budgets[category] || 1, 1) * 100} color={categorySpend(category) > data.budgets[category] ? 'var(--rose)' : undefined} /></div>)}</Card><Card className="span-4" title="Recent activity"><div className="list">{data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(item => <div className="transaction-row" key={item.id}><span><b>{item.title}</b><small>{item.category} · {fmtDate(item.date)}</small></span><b className={item.type === 'in' ? 'text-green' : ''}>{item.type === 'in' ? '+' : '-'}{inr(item.amount)}</b></div>)}</div></Card></div></>;
  };
  const renderTransactions = () => {
    const transactions = data.transactions.filter(item => transactionTab === 'all' || transactionTab === item.type || transactionTab === item.category).sort((a, b) => b.date.localeCompare(a.date));
    return <>{pageHeader('Transactions', 'Finance / History', 'Add transaction')}<Card><div className="row between wrap table-toolbar"><div className="tabs">{['all', 'in', 'out', ...CATEGORIES].map(tab => <button key={tab} onClick={() => setTransactionTab(tab)} className={transactionTab === tab ? 'on' : ''}>{tab === 'in' ? 'Income' : tab === 'out' ? 'Expenses' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</div><Button variant="primary" onClick={() => addNew('transaction')}><Plus size={16} />Add transaction</Button></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="align-right">Amount</th><th /></tr></thead><tbody>{transactions.map(item => <tr key={item.id}><td>{fmtDate(item.date)}</td><td><b>{item.title}</b></td><td><span className="pill">{item.category}</span></td><td className={`num align-right ${item.type === 'in' ? 'text-green' : ''}`}>{item.type === 'in' ? '+' : '-'}{inr(item.amount)}</td><td className="row"><IconButton label="Edit transaction" onClick={() => openForm('transaction', item.id)}><Settings size={15} /></IconButton><IconButton label="Delete transaction" onClick={() => setModal({ kind: 'delete', entity: 'transaction', id: item.id })}><Trash2 size={15} /></IconButton></td></tr>)}</tbody></table></div> : <Empty title="No transactions" text="Record income or an expense to see it here." />}</Card></>;
  };
  const renderBudgets = () => {
    const total = Object.values<number>(data.budgets).reduce((sum, amount) => sum + amount, 0);
    return <>{<PageTitle eyebrow="FINANCE / BUDGETS" title="Monthly budgets" subtitle="Give every category a useful limit." action="Set budgets" onAction={() => addNew('budget')} />}<div className="content-grid"><Card className="span-4 centered" title="Overall"><Gauge value={expenses / Math.max(total, 1) * 100} label={`of ${inr(total)} used`} color={expenses > total ? 'var(--rose)' : 'var(--acc)'} /><p className="sm mute">{inr(total - expenses)} left to spend</p><Button variant="primary" onClick={() => addNew('budget')}><Settings size={15} />Set budgets</Button></Card><Card className="span-8" title="By category">{CATEGORIES.map((category, index) => { const limit = data.budgets[category] || 0; const spent = categorySpend(category); return <div className="budget-row" key={category}><div className="row between"><b>{category}</b><span className="sm"><b className="num">{inr(spent)}</b> of {inr(limit)} <span className={`pill ${spent > limit ? 'priority-high' : 'ok'}`}>{spent > limit ? `Over by ${inr(spent - limit)}` : `${inr(limit - spent)} left`}</span></span></div><Progress value={spent / Math.max(limit, 1) * 100} color={spent > limit ? 'var(--rose)' : spent / Math.max(limit, 1) > .8 ? 'var(--amber)' : COLORS[index]} /></div>; })}</Card></div></>;
  };
  const renderNotes = () => {
    const notes = data.notes.filter(note => `${note.title} ${note.body}`.toLowerCase().includes(noteQuery.toLowerCase()));
    const note = data.notes.find(item => item.id === selectedNote) || notes[0];
    return <>{pageHeader('Notes', 'Capture ideas next to the work they belong to.', 'New note')}<div className="content-grid"><Card className="span-4"><div className="row note-search"><div className="search-field"><Search size={16} /><input placeholder="Search notes" value={noteQuery} onChange={event => setNoteQuery(event.target.value)} /></div><IconButton label="New note" onClick={() => addNew('note')}><Plus size={17} /></IconButton></div><div className="note-list">{notes.map(item => <button key={item.id} className={`note-item ${note?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedNote(item.id)}><b>{item.title}</b><span>{item.body}</span></button>)}</div>{!notes.length && <Empty title="No notes found" text="Try a different search or write a new note." />}</Card><Card className="span-8">{note ? <><div className="row between wrap"><div><h2 className="note-title">{note.title}</h2><span className="sm mute">{fmtDate(note.date)} · {note.projectId ? projectName(note.projectId) : 'No project'}</span></div><div className="row"><Button onClick={() => openForm('note', note.id)}>Edit</Button><Button onClick={() => setModal({ kind: 'delete', entity: 'note', id: note.id })}><Trash2 size={15} />Delete</Button></div></div><div className="note-body">{note.body}</div></> : <Empty title="No note selected" text="Create a note to get started." action={<Button variant="primary" onClick={() => addNew('note')}><Plus size={15} />New note</Button>} />}</Card></div></>;
  };
  const renderCalendar = () => {
    const chosen = new Date(`${calendarDate}T12:00:00`);
    const monthStart = new Date(chosen.getFullYear(), chosen.getMonth(), 1);
    const monthEnd = new Date(chosen.getFullYear(), chosen.getMonth() + 1, 0);
    const start = calendarView === 'month' ? new Date(monthStart.getFullYear(), monthStart.getMonth(), -monthStart.getDay() + 1) : new Date(chosen);
    if (calendarView === 'week') start.setDate(chosen.getDate() - chosen.getDay());
    const dayCount = calendarView === 'month' ? Math.ceil((monthEnd.getDate() + monthStart.getDay()) / 7) * 7 : 7;
    const dates = Array.from({ length: dayCount }, (_, index) => {
      const current = new Date(start); current.setDate(start.getDate() + index);
      return toISODate(current);
    });
    const itemsFor = (date: string) => [...data.events.filter(item => item.date === date).map(item => ({ id: item.id, title: item.title, type: 'event' })), ...data.tasks.filter(item => item.due === date && item.status !== 'done').map(item => ({ id: item.id, title: item.title, type: 'task' }))];
    return <>{pageHeader('Calendar', 'Deadlines and events in one place.', 'Add event')}<div className="content-grid"><Card className="span-8"><div className="row between wrap calendar-toolbar"><div className="row"><IconButton label="Previous" onClick={() => { const next = new Date(chosen); next.setMonth(next.getMonth() - 1); setCalendarDate(toISODate(next)); }}><ChevronLeft size={18} /></IconButton><h2>{chosen.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><IconButton label="Next" onClick={() => { const next = new Date(chosen); next.setMonth(next.getMonth() + 1); setCalendarDate(toISODate(next)); }}><ChevronRight size={18} /></IconButton></div><div className="seg">{(['month', 'week'] as const).map(view => <button key={view} className={calendarView === view ? 'on' : ''} onClick={() => setCalendarView(view)}>{view}</button>)}</div></div><div className={`calendar-grid ${calendarView}`}><div className="calendar-day-labels">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days">{dates.map(date => <button key={date} className={`calendar-day ${date === TODAY ? 'today' : ''} ${date === calendarDate ? 'selected' : ''} ${new Date(`${date}T12:00:00`).getMonth() !== chosen.getMonth() && calendarView === 'month' ? 'outside' : ''}`} onClick={() => setCalendarDate(date)}><span>{new Date(`${date}T12:00:00`).getDate()}</span>{itemsFor(date).slice(0, calendarView === 'week' ? 5 : 2).map(item => <i className={item.type} key={item.id}>{item.title}</i>)}{calendarView === 'month' && itemsFor(date).length > 2 && <small>+{itemsFor(date).length - 2} more</small>}</button>)}</div></div></Card><Card className="span-4" title={fmtDate(calendarDate)}><p className="sm mute">{itemsFor(calendarDate).length} item{itemsFor(calendarDate).length === 1 ? '' : 's'}</p>{itemsFor(calendarDate).length ? <div className="list">{itemsFor(calendarDate).map(item => <button className="calendar-item" key={item.id} onClick={() => item.type === 'task' && navigate(`task-${item.id}`)}><CalendarDays size={16} /><span><b>{item.title}</b><small>{item.type === 'task' ? 'Task due' : 'Calendar event'}</small></span></button>)}</div> : <Empty title="Nothing scheduled" text="Enjoy the open day." />}<Button variant="primary" onClick={() => addNew('event')}><Plus size={15} />Add event</Button></Card></div></>;
  };
  const renderAnalytics = () => {
    const labels = range === '7' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : range === '90' ? ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'] : ['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23', '25', '27'];
    const values = range === '7' ? [62, 48, 71, 78, 69, 86, 81] : range === '90' ? [48, 55, 60, 66, 71, 76] : [54, 58, 61, 63, 66, 70, 72, 69, 74, 76, 78, 75, 79, 81];
    return <>{pageHeader('Analytics', 'Personal progress across everything you track.')}<div className="row between wrap range-toolbar"><div className="seg">{['7', '30', '90'].map(item => <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item} days</button>)}</div><span className="sm mute">All charts follow the selected range</span></div><div className="dashboard-grid"><Card className="span-8" title="Productivity score" action={<span className="pill ok">+{range === '7' ? '7' : range === '30' ? '12' : '28'} vs previous</span>}><TrendChart values={values} labels={labels} /></Card><Card className="span-4 centered" title="Average score"><Gauge value={range === '7' ? 81 : range === '30' ? 76 : 68} label="out of 100" /><span className="sm mute">Target 70</span></Card><Card className="span-4" title="Task completion"><BarChart values={range === '7' ? [5, 3, 6, 7, 4, 8, 6] : [22, 26, 24, 30, 28, 32, 35]} labels={range === '7' ? labels : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']} /></Card><Card className="span-4" title="Project completion">{data.projects.map(project => { const tasks = data.tasks.filter(task => task.projectId === project.id); return <div className="status-progress" key={project.id}><div className="row between"><b>{project.name}</b><span className="num">{Math.round(tasks.filter(task => task.status === 'done').length / Math.max(tasks.length, 1) * 100)}%</span></div><Progress value={tasks.filter(task => task.status === 'done').length / Math.max(tasks.length, 1) * 100} color={project.color} /></div>; })}</Card><Card className="span-4" title="Habit consistency"><Heatmap active={date => data.habits.some(habit => habit.checks.includes(date))} /><span className="sm mute">Average {Math.round(data.habits.filter(habit => habit.checks.includes(TODAY)).length / Math.max(data.habits.length, 1) * 100)}% completion</span></Card><Card className="span-6" title="Income and expense trend"><TrendChart values={[income * .6, expenses * .7, income * .8, expenses * .9, income, expenses]} labels={['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']} color="var(--green)" /></Card><Card className="span-6" title="Budget utilisation">{CATEGORIES.slice(0, 4).map((category, index) => <div key={category} className="budget-gauge"><Gauge value={categorySpend(category) / Math.max(data.budgets[category] || 1, 1) * 100} label={category} color={COLORS[index]} /></div>)}</Card><Card className="span-12" title="Time split by project"><div className="row wrap"><Donut values={data.projects.slice(0, 4).map((_, index) => [42, 28, 18, 12][index])} colors={data.projects.slice(0, 4).map(project => project.color)} center="38 h" label="this month" /><div className="project-share">{data.projects.slice(0, 4).map((project, index) => <div key={project.id}><i style={{ background: project.color }} /><span>{project.name}</span><b>{[42, 28, 18, 12][index]}%</b></div>)}</div></div></Card></div></>;
  };
  const renderSettings = () => <>{pageHeader('Profile & settings', 'Your account and preferences.')}<div className="content-grid"><Card className="span-6" title="Profile"><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); updateData(previous => ({ ...previous, profile: { name: String(form.get('name')), email: String(form.get('email')), currency: String(form.get('currency')), weekStarts: String(form.get('weekStarts')) } })); setProfileSaved(true); showToast('Profile saved'); }}><div className="row profile-avatar"><span className="avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span><Button className="small" onClick={() => showToast('Photo upload is a design placeholder')}>Change photo</Button></div><Field label="Full name"><input name="name" defaultValue={data.profile.name} required /></Field><Field label="Email"><input name="email" type="email" defaultValue={data.profile.email} required /></Field><div className="form-grid"><Field label="Currency"><select name="currency" defaultValue={data.profile.currency}><option>INR (₹)</option><option>USD ($)</option></select></Field><Field label="Week starts on"><select name="weekStarts" defaultValue={data.profile.weekStarts}><option>Monday</option><option>Sunday</option></select></Field></div><Button variant="primary" type="submit">Save changes</Button>{profileSaved && <span className="sm text-green"> Saved</span>}</form></Card><div className="span-6 side-stack"><Card title="Preferences">{['Weekly summary email', 'Overdue task reminders', 'Budget alerts at 80%'].map((label, index) => <label className="preference-row" key={label}><span>{label}</span><input type="checkbox" checked={preferences[index]} onChange={event => setPreferences(previous => previous.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /></label>)}<label className="preference-row"><span>Dark appearance</span><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)} /></label></Card><Card title="Account"><form onSubmit={event => { event.preventDefault(); showToast('Password updated'); }}><div className="form-grid"><Field label="Current password"><input type="password" required minLength={8} placeholder="••••••••" /></Field><Field label="New password"><input type="password" required minLength={8} placeholder="At least 8 characters" /></Field></div><Button>Update password</Button></form><div className="row wrap account-actions"><Button onClick={() => { setAuthed(false); navigate('landing'); }}> <LogOut size={15} />Sign out</Button><Button className="danger-text" onClick={() => setModal({ kind: 'delete', entity: 'account' })}>Delete account</Button></div></Card></div></div></>;
  const renderStates = () => {
    const modules = ['Tasks', 'Projects', 'Habits', 'Finance', 'Notes', 'Calendar'];
    const stateOptions = ['empty', 'loading', 'error', 'success', 'done'];
    return <>{pageHeader('Application states', 'Empty, loading, error, success and completed states for each module.')}<div className="state-grid">{modules.map(module => {
      const state = sampleState[module] || 'empty';
      return <Card key={module} title={module}><div className="seg state-seg">{stateOptions.map(option => <button key={option} className={state === option ? 'on' : ''} onClick={() => setSampleState(previous => ({ ...previous, [module]: option }))}>{option}</button>)}</div><div className="state-preview">{state === 'loading' ? <div className="skeletons"><i /><i /><i /><i /></div> : state === 'error' ? <div className="error-box"><b>Could not load {module.toLowerCase()}</b><p>Check your connection and try again. Your data is safe.</p><Button className="small" onClick={() => setSampleState(previous => ({ ...previous, [module]: 'loading' }))}>Try again</Button></div> : state === 'done' ? <div className="state-message"><CheckCheck size={26} /><b>{module === 'Tasks' ? 'All tasks completed' : module === 'Habits' ? '7 day streak complete' : 'All caught up'}</b><span>Nice work. Plan the next step or take a break.</span><Progress value={100} color="var(--green)" /></div> : state === 'success' ? <div className="state-message"><Check size={25} /><b>{module.slice(0, -1)} saved</b><span>It now appears in your dashboard and {module.toLowerCase()} views.</span></div> : <Empty title={`No ${module.toLowerCase()} yet`} text="Create your first one to see it here." action={<Button className="small" onClick={() => setSampleState(previous => ({ ...previous, [module]: 'success' }))}><Plus size={14} />Create</Button>} />}</div></Card>;
    })}</div><Card title="Loaders" className="loaders-card"><div className="loader-samples"><div className="spinner" /><div className="loading-dots"><i /><i /><i /></div><div className="loader-progress"><Progress value={60} /><span className="sm mute">Import progress</span></div></div></Card><Card title="Dialogs and feedback"><div className="row wrap"><Button onClick={() => setModal({ kind: 'delete', entity: 'task', id: data.tasks[0]?.id })}>Delete confirmation</Button><Button variant="primary" onClick={() => addNew('task')}>Create form</Button><Button onClick={() => openForm('task', data.tasks[0]?.id)}>Edit form</Button><Button onClick={() => showToast('Task saved')}>Success toast</Button></div></Card></>;
  };
  const renderResponsive = () => <>{pageHeader('Responsive layouts', 'The workspace adapts from desktop sidebar to a compact mobile navigation.')}<div className="responsive-preview"><div className="device"><div className="device-screen"><div className="row between"><b>Good evening</b><span className="avatar small-avatar">{data.profile.name.slice(0, 1)}</span></div><div className="mini-hero"><span className="mono">TODAY · WEEK AT A GLANCE</span><h2>Two priorities left</h2><div className="hero-chips"><span><b>{taskTotals.done}/{taskTotals.total}</b> tasks</span><span><b>40%</b> habits</span></div></div><Card title="Productivity"><TrendChart values={[42, 56, 48, 71, 66, 85]} labels={['M', 'T', 'W', 'T', 'F', 'S']} /></Card>{data.tasks.slice(0, 2).map(task => renderTask(task, true))}</div><div className="device-nav">{NAV.slice(0, 5).map(item => <item.icon key={item.route} size={17} />)}</div></div><div className="responsive-description"><h2>Designed for your screen.</h2><p className="mute">The left rail collapses on smaller screens and becomes a bottom navigation bar on mobile. Cards stack naturally, content remains readable, and the most-used actions stay close to your thumb.</p><div className="responsive-breakpoints"><div><b>≤ 900px</b><span>Compact navigation</span></div><div><b>≤ 640px</b><span>Single-column cards</span></div></div></div></div></>;

  const pageTitle = route.startsWith('task-') ? 'Tasks' : route.startsWith('project-') ? 'Projects' : NAV.find(item => item.route === currentRoute)?.label || (currentRoute === 'transactions' || currentRoute === 'budgets' ? 'Finance' : currentRoute === 'states' ? 'Application states' : 'Responsive layouts');
  if (currentRoute === 'landing') return <LandingPage data={data} />;
  if (['signin', 'signup', 'forgot', 'reset'].includes(currentRoute)) return <AuthPage mode={currentRoute as 'signin' | 'signup' | 'forgot' | 'reset'} onMode={next => { location.hash = next; }} onLogin={login} profileName={data.profile.name} />;

  let content: React.ReactNode;
  if (route.startsWith('task-')) content = renderTaskDetails();
  else if (route.startsWith('project-')) content = renderProjectDetails();
  else if (currentRoute === 'dashboard') content = renderDashboard();
  else if (currentRoute === 'tasks') content = renderTasks();
  else if (currentRoute === 'projects') content = renderProjects();
  else if (currentRoute === 'habits') content = renderHabits();
  else if (currentRoute === 'finance') content = renderFinance();
  else if (currentRoute === 'transactions') content = renderTransactions();
  else if (currentRoute === 'budgets') content = renderBudgets();
  else if (currentRoute === 'notes') content = renderNotes();
  else if (currentRoute === 'calendar') content = renderCalendar();
  else if (currentRoute === 'analytics') content = renderAnalytics();
  else if (currentRoute === 'settings') content = renderSettings();
  else if (currentRoute === 'states') content = renderStates();
  else if (currentRoute === 'responsive') content = renderResponsive();
  else content = renderDashboard();
  const paletteItems = [...NAV.map(item => ({ label: item.label, route: item.route, kind: 'Page' })), { label: 'Transactions', route: 'transactions', kind: 'Page' }, { label: 'Budgets', route: 'budgets', kind: 'Page' }, { label: 'Application states', route: 'states', kind: 'Page' }, { label: 'Responsive layouts', route: 'responsive', kind: 'Page' }, ...data.tasks.map(task => ({ label: task.title, route: `task-${task.id}`, kind: 'Task' })), ...data.notes.map(note => ({ label: note.title, route: 'notes', kind: 'Note' })), ...(['task', 'project', 'habit', 'note', 'transaction'] as const).map(entity => ({ label: `New ${entity}`, route: `create-${entity}`, kind: 'Create' }))].filter(item => item.label.toLowerCase().includes(paletteQuery.toLowerCase())).slice(0, 9);
  const paletteAction = (item: { label: string; route: string }) => {
    if (item.route.startsWith('create-')) { addNew(item.route.slice(7) as FormEntity); setPaletteOpen(false); return; }
    if (item.route === 'notes') setSelectedNote(data.notes.find(note => note.title === item.label)?.id || selectedNote);
    navigate(item.route);
  };
  return <div className="app-shell">
    <aside className={`rail ${collapsed ? 'collapsed' : ''}`}><div className="rail-brand"><a className="brand" href="#dashboard"><span className="brand-mark">D</span><span className="brand-label">DayLoop</span></a><IconButton label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(value => !value)} className="rail-toggle"><PanelLeft size={17} /></IconButton></div><nav className="side-nav">{NAV.map(item => { const Icon = item.icon; const active = currentRoute === item.route || (item.route === 'finance' && ['transactions', 'budgets'].includes(currentRoute)) || (item.route === 'tasks' && route.startsWith('task-')) || (item.route === 'projects' && route.startsWith('project-')); return <a key={item.route} href={`#${item.route}`} title={collapsed ? item.label : undefined} className={active ? 'active' : ''}><Icon size={18} /><span>{item.label}</span>{item.route === 'tasks' && taskTotals.overdue > 0 && <small>{taskTotals.overdue}</small>}</a>; })}</nav><div className="rail-spacer" /><a className="streak-card" href="#habits"><span className="flame"><Flame size={18} /></span><span><b>7 day streak</b><small>Keep the loop going</small></span></a><button className="rail-profile" onClick={() => navigate('settings')}><span className="avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span><span><b>{data.profile.name}</b><small>Personal workspace</small></span><ChevronDown size={15} /></button></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{pageTitle}</b></div><div className="topbar-actions"><button className="command-search" onClick={() => setPaletteOpen(true)}><Search size={16} /><span>Search or jump to...</span><kbd>Ctrl K</kbd></button><IconButton label="Notifications" onClick={() => showToast('You are all caught up')} className="notification-btn"><Bell size={18} /><i /></IconButton><IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(value => !value)}><>{dark ? <Sun size={18} /> : <Moon size={18} />}</></IconButton><Button variant="primary" className="top-new" onClick={() => setModal({ kind: 'form', entity: 'task' })}><Plus size={16} />New</Button></div></header><div className="page-content">{content}</div>
    </main>
    {paletteOpen && <div className="palette-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><div className="palette" role="dialog" aria-modal="true" aria-label="Command palette"><div className="palette-input"><Search size={18} /><input autoFocus value={paletteQuery} onChange={event => { setPaletteQuery(event.target.value); setPaletteIndex(0); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setPaletteIndex(index => Math.min(paletteItems.length - 1, index + 1)); } else if (event.key === 'ArrowUp') { event.preventDefault(); setPaletteIndex(index => Math.max(0, index - 1)); } else if (event.key === 'Enter' && paletteItems[paletteIndex]) { event.preventDefault(); paletteAction(paletteItems[paletteIndex]); } }} placeholder="Search pages, tasks, notes or type a command" /><kbd>ESC</kbd></div><div className="palette-list">{paletteItems.length ? paletteItems.map((item, index) => <button key={`${item.kind}-${item.route}-${item.label}`} className={index === paletteIndex ? 'selected' : ''} onMouseEnter={() => setPaletteIndex(index)} onClick={() => paletteAction(item)}><span>{item.kind === 'Task' ? <CheckSquare size={17} /> : item.kind === 'Create' ? <Plus size={17} /> : item.kind === 'Note' ? <FileText size={17} /> : <Command size={17} />}{item.label}</span><small>{item.kind}</small></button>) : <p className="mute">No matches. Try another word.</p>}<button onClick={() => setDark(value => !value)}><span>{dark ? <Sun size={17} /> : <Moon size={17} />}Toggle appearance</span><small>Action</small></button></div><div className="palette-footer"><span><kbd>↑↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div></div>}
    {modal && <Modal modal={modal} data={data} calendarDate={calendarDate} onClose={() => setModal(null)} onSubmit={submitForm} onDelete={deleteEntity} />}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>;
}

function Modal({ modal, data, calendarDate, onClose, onSubmit, onDelete }: { modal: ModalState; data: Data; calendarDate: string; onClose: () => void; onSubmit: (entity: FormEntity, id: string | undefined, form: FormData, projectId?: string) => void; onDelete: (entity: 'task' | 'project' | 'habit' | 'transaction' | 'note' | 'account', id?: string) => void }) {
  if (modal.kind === 'delete') return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal confirm-modal" role="dialog" aria-modal="true"><IconButton label="Close" onClick={onClose} className="modal-close"><X size={18} /></IconButton><span className="confirm-icon"><Trash2 size={20} /></span><h2>{modal.entity === 'account' ? 'Delete your account?' : `Delete this ${modal.entity}?`}</h2><p className="mute">{modal.entity === 'account' ? 'This will sign you out of this local demo workspace.' : 'This action cannot be undone. The item will be removed from this workspace.'}</p><div className="row modal-actions"><Button onClick={onClose}>Cancel</Button><Button variant="primary" className="delete-button" onClick={() => onDelete(modal.entity, modal.id)}>Delete</Button></div></section></div>;
  const entity = modal.entity;
  const item = entity === 'task' ? data.tasks.find(value => value.id === modal.id) : entity === 'project' ? data.projects.find(value => value.id === modal.id) : entity === 'habit' ? data.habits.find(value => value.id === modal.id) : entity === 'transaction' ? data.transactions.find(value => value.id === modal.id) : entity === 'note' ? data.notes.find(value => value.id === modal.id) : undefined;
  const title = modal.id ? `Edit ${entity}` : entity === 'budget' ? 'Set budget' : entity === 'event' ? 'Add calendar event' : `New ${entity}`;
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(entity, modal.id, new FormData(event.currentTarget), modal.projectId); };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="row between modal-heading"><div><p className="eyebrow">DAYLOOP / WORKSPACE</p><h2 id="modal-title">{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton></div><form onSubmit={submit}>
    {entity === 'task' && <><Field label="Task title"><input name="title" defaultValue={(item as Task | undefined)?.title} required autoFocus /></Field><Field label="Description"><textarea name="desc" defaultValue={(item as Task | undefined)?.desc} /></Field><div className="form-grid"><Field label="Due date"><input name="due" type="date" defaultValue={(item as Task | undefined)?.due || calendarDate} /></Field><Field label="Priority"><select name="priority" defaultValue={(item as Task | undefined)?.priority || 'med'}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select></Field></div><div className="form-grid"><Field label="Project"><select name="projectId" defaultValue={(item as Task | undefined)?.projectId || modal.projectId || ''}><option value="">No project</option>{data.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field><Field label="Status"><select name="status" defaultValue={(item as Task | undefined)?.status || 'todo'}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Completed</option></select></Field></div></>}
    {entity === 'project' && <><Field label="Project name"><input name="name" defaultValue={(item as Project | undefined)?.name} required autoFocus /></Field><Field label="Description"><textarea name="desc" defaultValue={(item as Project | undefined)?.desc} /></Field><div className="form-grid"><Field label="Deadline"><input name="deadline" type="date" defaultValue={(item as Project | undefined)?.deadline || addDays(TODAY, 30)} /></Field><Field label="Status"><select name="status" defaultValue={(item as Project | undefined)?.status || 'active'}><option value="active">Active</option><option value="planned">Planned</option><option value="completed">Completed</option></select></Field></div></>}
    {entity === 'habit' && <><Field label="Habit name"><input name="name" defaultValue={(item as Habit | undefined)?.name} required autoFocus /></Field><Field label="Description"><textarea name="description" placeholder="What does this routine help you do?" /></Field></>}
    {entity === 'transaction' && <><Field label="Description"><input name="title" defaultValue={(item as Transaction | undefined)?.title} required autoFocus /></Field><div className="form-grid"><Field label="Type"><select name="type" defaultValue={(item as Transaction | undefined)?.type || 'out'}><option value="out">Expense</option><option value="in">Income</option></select></Field><Field label="Amount"><input name="amount" type="number" min="0.01" step="0.01" defaultValue={(item as Transaction | undefined)?.amount} required /></Field></div><div className="form-grid"><Field label="Category"><select name="category" defaultValue={(item as Transaction | undefined)?.category || 'Food'}>{['Income', ...CATEGORIES].map(category => <option key={category}>{category}</option>)}</select></Field><Field label="Date"><input name="date" type="date" defaultValue={(item as Transaction | undefined)?.date || TODAY} /></Field></div></>}
    {entity === 'budget' && <><Field label="Category"><select name="category">{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></Field><Field label="Monthly limit"><input name="amount" type="number" min="1" step="1" required autoFocus /></Field></>}
    {entity === 'note' && <><Field label="Title"><input name="title" defaultValue={(item as Note | undefined)?.title} required autoFocus /></Field><Field label="Content"><textarea name="body" className="note-textarea" defaultValue={(item as Note | undefined)?.body} /></Field><Field label="Project"><select name="projectId" defaultValue={(item as Note | undefined)?.projectId || modal.projectId || ''}><option value="">No project</option>{data.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field></>}
    {entity === 'event' && <><Field label="Event title"><input name="title" required autoFocus /></Field><div className="form-grid"><Field label="Date"><input name="date" type="date" defaultValue={calendarDate} /></Field><Field label="Time"><input name="time" type="time" defaultValue="09:00" /></Field></div></>}
    <div className="row modal-actions"><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit">{modal.id ? 'Save changes' : entity === 'budget' ? 'Save budget' : 'Create'}</Button></div>
  </form></section></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
