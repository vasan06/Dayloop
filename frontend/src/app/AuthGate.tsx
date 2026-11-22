import { createContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Eye, EyeOff, Flame, Target, TimerReset } from "lucide-react";
import Landing from "./Landing";
import { Logo } from "../components/Shell";
import { Modal } from "../components/ui";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { apiRequest } from "../lib/api";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { firebaseAuth, firebaseConfigured, firebaseMissingConfig } from "../lib/firebase";
import { deactivateMobileAccount, isNativeMobile } from "../lib/mobileData";
import { resetMobileWorkspace } from "../lib/mobileApi";

type Profile = {
  email: string | null;
  display_name: string | null;
  username: string | null;
  age: number | null;
  role: string | null;
  onboarding_completed: boolean;
  tour_completed: boolean;
};

type ProfileDraft = {
  display_name: string;
  username: string;
  age: string;
  role: string;
};

const emptyProfile: ProfileDraft = {
  display_name: "",
  username: "",
  age: "",
  role: "",
};

function authErrorMessage(reason: unknown, fallback: string): string {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code ?? "")
    : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "That email and password combination wasn’t recognised.",
    "auth/user-not-found": "No account was found for that email address.",
    "auth/wrong-password": "That password doesn’t match this account.",
    "auth/email-already-in-use": "An account already exists with this email. Try signing in instead.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed": "Firebase couldn’t reach its authentication service. Check your connection and try again.",
    "auth/unauthorized-domain": "This address isn’t authorised in Firebase. Add localhost to Authentication → Settings → Authorised domains.",
    "auth/operation-not-allowed": "Email and password sign-in is not enabled for this Firebase project.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before completion.",
  };
  return messages[code] ?? (reason instanceof Error ? reason.message : fallback);
}

const roleOptions = [
  ["school_student", "School student"],
  ["student", "College / university student"],
  ["working", "Working professional"],
  ["freelancer", "Freelancer"],
  ["entrepreneur", "Entrepreneur"],
  ["organization", "Organization"],
  ["educator", "Educator"],
  ["other", "Other"],
];

export const ReplayTour = createContext<() => void>(() => {});

type TourStep = { title: string; body: string; target: string };

function GuidedTour({ step, index, total, busy, error, onNext, onSkip }: {
  step: TourStep; index: number; total: number; busy: boolean; error: string;
  onNext: () => void; onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const update = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) { setRect(null); return; }
      element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      window.setTimeout(() => setRect(element.getBoundingClientRect()), 180);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step.target]);

  const cardLeft = rect ? Math.min(window.innerWidth - 350, Math.max(18, rect.right + 18)) : 24;
  const cardTop = rect ? Math.min(window.innerHeight - 230, Math.max(18, rect.top - 16)) : 90;
  return <div className="tour-guide-layer" role="dialog" aria-modal="true" aria-label={step.title}>
    {rect && <div className="tour-spotlight" style={{ left: rect.left - 7, top: rect.top - 7, width: rect.width + 14, height: rect.height + 14 }} />}
    <section className="tour-callout" style={{ left: cardLeft, top: cardTop }}>
      <div className="mono">DayLoop tour · {index + 1}/{total}</div>
      <h2>{step.title}</h2><p>{step.body}</p>
      {error && <p className="err">{error}</p>}
      <div className="tour-actions"><button className="btn ghost" disabled={busy} onClick={onSkip}>Skip</button><div className="sp" /><button className="btn pri" disabled={busy} onClick={onNext}>{index === total - 1 ? "Finish" : "Next"}</button></div>
    </section>
  </div>;
}

type Mode = "landing" | "signin" | "signup" | "forgot";

export default function AuthGate({ children }: { children: (signOut: () => void, identity: string) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [localAccess, setLocalAccess] = useState(
    () => {
      if (firebaseConfigured) return false;
      try { return import.meta.env.DEV && localStorage.getItem("dayloop:local-access") === "true"; }
      catch { return false; }
    },
  );
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [mode, setMode] = useState<Mode>("landing");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [info, setInfo] = useState("");
  const register = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    let active = true;
    let generation = 0;

    async function checkProfile(displayName = "") {
      const request = ++generation;
      setLoading(true);
      setProfileError("");
      try {
        const response = await apiRequest<{ item: Profile | null }>("/profile");
        if (!active || generation !== request) return;
        const profile = response.item;
        const complete = Boolean(profile?.username && profile.age && profile.role);
        setProfileReady(complete);
        setDraft({
          display_name: profile?.display_name || displayName,
          username: profile?.username || "",
          age: profile?.age ? String(profile.age) : "",
          role: profile?.role || "",
        });
        setTourOpen(Boolean(complete && !profile?.tour_completed));
      } catch (reason) {
        if (active && request === generation) {
          setProfileError(reason instanceof Error ? reason.message : "Could not load your profile.");
        }
      } finally {
        if (active && request === generation) setLoading(false);
      }
    }

    if (!firebaseAuth) {
      if (localAccess) void checkProfile();
      else setLoading(false);
      return () => {
        active = false;
      };
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!active) return;
      generation++;
      setUser(nextUser);
      setProfileReady(false);
      setDraft(emptyProfile);
      setTourOpen(false);
      setReplaying(false);
      setTourStep(0);
      if (nextUser) {
        setPassword("");
        setConfirmPassword("");
        setShowPw(false);
        setShowConfirmPw(false);
      }
      setError("");
      if (nextUser) {
        void checkProfile(nextUser.displayName ?? "");
      } else if (localAccess) {
        void checkProfile();
      } else {
        if (isNativeMobile) {
          resetMobileWorkspace();
          void deactivateMobileAccount().catch(() => {});
        }
        setProfileReady(false);
        setProfileError("");
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [localAccess]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setError("");
    setInfo("");
    if (register) {
      if (password.length < 8) { setError("Use at least 8 characters for a stronger password."); return; }
      if (password !== confirmPassword) { setError("Your passwords do not match yet. Check both fields and try again."); return; }
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await sendPasswordResetEmail(firebaseAuth, email.trim());
        setInfo("If that email has an account, a reset link is on its way.");
      } else if (register) {
        if (!isNativeMobile) await setPersistence(firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await credential.user.getIdToken(true);
        setProfileReady(false);
      } else {
        if (!isNativeMobile) await setPersistence(firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
    } catch (reason) {
      setError(authErrorMessage(reason, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!firebaseAuth) return;
    setError("");
    setBusy(true);
    try {
      if (!isNativeMobile) await setPersistence(firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      if (isNativeMobile) {
        // A WebView redirect may leave DayLoop blank after the Google chooser.
        // Use native Google account selection and exchange the resulting ID token
        // for the SAME Firebase web user used by all DayLoop API requests.
        const native = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = native.credential?.idToken;
        if (!idToken) {
          throw new Error("Google sign-in did not return an ID token. Check Firebase Android app configuration and SHA-1 fingerprint.");
        }
        await signInWithCredential(firebaseAuth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(firebaseAuth, provider);
      }
    } catch (reason) {
      setError(authErrorMessage(reason, "Google sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({
          display_name: draft.username.trim(),
          username: draft.username.trim(),
          age: Number(draft.age),
          role: draft.role,
          onboarding_completed: true,
        }),
      });
      setProfileReady(true);
      setTourOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveWorkspace() {
    setError("");
    if (user && firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not sign out.");
      }
    }
    try { localStorage.removeItem("dayloop:local-access"); } catch { /* Private browsing. */ }
    setLocalAccess(false);
    setProfileReady(false);
    setMode("signin");
  }

  const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const passwordMatches = confirmPassword.length > 0 && password === confirmPassword;
  const brand = (
    <div className="auth-brand">
      <Logo light={false} />
      {!user && !localAccess && (
        <button type="button" className="auth-back" onClick={() => { setMode("landing"); setError(""); setInfo(""); }}>
          Back to DayLoop
        </button>
      )}
    </div>
  );
  const shell = (content: ReactNode) => (
    <main className={`auth auth-v2 auth-mode-${mode}`}>
      <section className="l auth-form-pane">
        <div className="fw">{content}</div>
      </section>
      <aside className="r auth-growth-pane" aria-label="DayLoop daily growth preview">
        <div className="auth-growth-wrap">
          <div className="auth-growth-copy">
            <span className="mono">DAILY SYSTEM</span>
            <h2>Build a day you can repeat.</h2>
            <p>Plan what matters, practise it consistently, and review the day before starting again.</p>
          </div>

          <section className="auth-day-card">
            <div className="auth-day-head">
              <span><CalendarDays />Saturday · 21 November</span>
              <strong>Today</strong>
            </div>

            <div className="auth-priority-list">
              <div className="done"><CheckCircle2 /><span>Review the first draft</span></div>
              <div><Target /><span>Make the DayLoop mobile app</span></div>
              <div><CheckCircle2 /><span>Read for 30 minutes</span></div>
            </div>

            <div className="auth-growth-stats">
              <div><span className="auth-stat-icon"><Flame /></span><strong>4 / 5</strong><small>habits kept</small></div>
              <div><span className="auth-stat-icon"><TimerReset /></span><strong>50m</strong><small>focused today</small></div>
              <div><span className="auth-stat-icon"><Target /></span><strong>2 / 3</strong><small>priorities done</small></div>
            </div>

            <div className="auth-focus-block">
              <time>14:30</time>
              <div><b>Design review</b><span>Protected focus block · 45 min</span></div>
            </div>
          </section>

          <div className="auth-review-row">
            <span>End-of-day review</span>
            <b>What moved forward today?</b>
          </div>
        </div>
      </aside>
    </main>
  );

  if (loading) return <div className="boot" role="status" aria-label="Loading"><div><div className="orbit"><i /><i /><i /></div><div className="bt">Opening your workspace</div><div className="msgs"><span>Connecting securely…</span><span>Syncing tasks…</span><span>Almost there…</span></div></div></div>;

  if (profileError && (user || localAccess)) {
    return shell(<>{brand}<h1>Can’t reach your workspace</h1><p className="mute">{profileError}</p><p className="mute sm">{profileError.startsWith("Network error:") ? "Check that the DayLoop API is running, then retry." : "Retry, or sign out and sign in again."}</p><button className="btn pri" onClick={() => window.location.reload()}>Retry connection</button><button className="btn ghost" onClick={() => void leaveWorkspace()}>Sign out</button></>);
  }

  if (user || localAccess) {
    if (!profileReady) {
      return shell(<form className="auth-form" onSubmit={saveProfile}>{brand}<div className="mono auth-kicker">YOUR ACCOUNT</div><h1 className="auth-title">Make this space yours.</h1><p className="auth-description">A few details to personalise your DayLoop workspace.</p>
        <div className="field"><label htmlFor="p-user">Username</label><input id="p-user" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.toLowerCase(), display_name: e.target.value.toLowerCase() })} /></div>
        <div className="fr"><div className="field"><label htmlFor="p-age">Age</label><input id="p-age" type="number" min={13} max={120} required value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} /></div>
          <div className="field"><label htmlFor="p-role">Role</label><select id="p-role" required value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}><option value="" disabled>Select</option>{roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn pri" disabled={busy}>{busy ? "Saving…" : "Continue to DayLoop"}</button>
        <button type="button" className="btn ghost" onClick={() => void leaveWorkspace()}>Sign out</button></form>);
    }
    const workspace = <ReplayTour.Provider value={() => {
      setReplaying(true);
      setError("");
      setTourStep(0);
      setTourOpen(true);
    }}>{children(() => void leaveWorkspace(), user ? `firebase:${user.uid}` : "local")}</ReplayTour.Provider>;
    if (tourOpen) {
      const tourSteps: TourStep[] = [
        { title: "Dashboard", body: "Your daily overview lives here: priorities, progress and the next things that need attention.", target: "dashboard" },
        { title: "Tasks", body: "Capture work, set due times and move each task toward completion.", target: "tasks" },
        { title: "Habits", body: "This is the habit hub. Check in, review streaks and open each habit's activity heatmap.", target: "habits" },
        { title: "Focus", body: "Start a focus timer, stopwatch or alarm without leaving your workspace.", target: "focus" },
        { title: "Projects", body: "Group related tasks into outcomes and track project progress.", target: "projects" },
        { title: "Finance", body: "Record income and expenses, then compare trends and budgets.", target: "finance" },
        { title: "Notes", body: "Write long structured pages with blocks, slash commands and automatic saving.", target: "notes" },
        { title: "Calendar", body: "Plan events and deadlines alongside your tasks.", target: "calendar" },
        { title: "Analytics", body: "Explore interactive trends across tasks, habits and money.", target: "analytics" },
        { title: "Notifications", body: "Open this bell for due items, events and unread updates.", target: "notifications" },
        { title: "Streaks", body: "Open the flame to see combined and individual habit streak history.", target: "streaks" },
        { title: "Feedback", body: "Use this anytime to send product feedback from the page you are on.", target: "feedback" },
        { title: "Sidebar", body: "Collapse or expand navigation here. Your main workspace stays available either way.", target: "sidebar" },
      ];
      const finishTour = async () => {
        if (busy) return;
        if (replaying) {
          setTourOpen(false);
          setReplaying(false);
          return;
        }
        setBusy(true);
        setError("");
        try {
          await apiRequest("/profile", { method: "PUT", body: JSON.stringify({ display_name: draft.username, username: draft.username, age: Number(draft.age), role: draft.role, onboarding_completed: true, tour_completed: true }) });
          setTourOpen(false);
          setTourStep(0);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Could not save your tour preference.");
        } finally { setBusy(false); }
      };
      const step = tourSteps[tourStep];
      return <>{workspace}
        <GuidedTour
          step={step}
          index={tourStep}
          total={tourSteps.length}
          busy={busy}
          error={error}
          onSkip={() => void finishTour()}
          onNext={() => tourStep === tourSteps.length - 1 ? void finishTour() : setTourStep((current) => current + 1)}
        />
      </>;
    }
    return <>{workspace}</>;
  }

  if (mode === "landing") return <Landing onSignIn={() => setMode("signin")} onSignUp={() => setMode("signup")} />;

  const configWarning = !firebaseConfigured && <div className="auth-config-warning" role="alert"><b>Firebase isn’t available in this Vite session.</b><span>Missing environment values: {firebaseMissingConfig.join(", ") || "Firebase could not be initialised"}.</span><small>{import.meta.env.DEV ? "Restart the frontend server after updating frontend/.env, or continue with the local identity below." : "Contact your workspace administrator to restore sign-in."}</small></div>;

  if (mode === "signin") return shell(<form className="auth-form auth-form-signin" onSubmit={submitAuth}>
    {brand}<div className="mono auth-kicker">WELCOME BACK</div><h1 className="auth-title">Welcome back.</h1>
    <p className="auth-description">Return to the workspace you already built.</p>{configWarning}
    <div className="field"><label htmlFor="signin-email">Email</label><input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(e)=>setEmail(e.target.value)}/></div>
    <div className="field auth-password-field"><label htmlFor="signin-pw">Password</label><div className="pw"><input id="signin-pw" type={showPw?"text":"password"} autoComplete="current-password" required value={password} onChange={(e)=>setPassword(e.target.value)}/><button type="button" aria-label={showPw?"Hide password":"Show password"} onClick={()=>setShowPw((s)=>!s)}>{showPw?<EyeOff className="ic"/>:<Eye className="ic"/>}</button></div></div>
    {!isNativeMobile && <label className="row sm" style={{ gap: 8 }}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me on this device</label>}
    {error&&<p className="err" role="alert">{error}</p>}
    <button className="btn pri auth-submit" disabled={!firebaseAuth||busy}>{busy?"Signing in…":"Sign in to DayLoop"}</button>
    {firebaseAuth&&<button type="button" className="btn auth-google" disabled={busy} onClick={()=>void signInWithGoogle()}><GoogleMark/>Continue with Google</button>}
    <div className="row sb sm auth-links"><button type="button" className="lnk acc" onClick={()=>{setMode("signup");setPassword("");setError("")}}>Create a new workspace</button><button type="button" className="lnk" onClick={()=>{setMode("forgot");setError("");setInfo("")}}>Forgot password?</button></div>
  </form>);

  if (mode === "signup") return shell(<form className="auth-form auth-form-signup" onSubmit={submitAuth}>
    {brand}<div className="signup-intro"><div className="mono auth-kicker">NEW WORKSPACE</div><h1 className="auth-title">Start with a clean loop.</h1><p className="auth-description">Create the account first. Username, role and profile details come next—after your email and password are secured.</p></div>
    <div className="signup-benefits"><span>Tasks + projects</span><span>Habits + focus</span><span>Notes + finance</span></div>{configWarning}
    <div className="field"><label htmlFor="signup-email">Email</label><input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(e)=>setEmail(e.target.value)}/></div>
    <div className="field auth-password-field"><label htmlFor="signup-pw">Create password</label><div className="pw"><input id="signup-pw" type={showPw?"text":"password"} autoComplete="new-password" minLength={8} required value={password} onChange={(e)=>setPassword(e.target.value)}/><button type="button" aria-label={showPw?"Hide password":"Show password"} onClick={()=>setShowPw((s)=>!s)}>{showPw?<EyeOff className="ic"/>:<Eye className="ic"/>}</button></div><div className="auth-strength"><div className={`meter s${strength}`}><i/><i/><i/><i/></div><small>{strength<2?"Use 8+ characters and mix letter types":strength<4?"Good start — add a number or symbol":"Strong password"}</small></div></div>
    <div className="field auth-password-field"><label htmlFor="signup-confirm">Confirm password</label><div className={`pw ${confirmPassword?passwordMatches?"is-match":"is-mismatch":""}`}><input id="signup-confirm" type={showConfirmPw?"text":"password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)}/><button type="button" aria-label={showConfirmPw?"Hide confirmation password":"Show confirmation password"} onClick={()=>setShowConfirmPw((s)=>!s)}>{showConfirmPw?<EyeOff className="ic"/>:<Eye className="ic"/>}</button></div><small className={confirmPassword?passwordMatches?"auth-match-good":"auth-match-bad":"auth-match-neutral"}>{confirmPassword?passwordMatches?"Passwords match":"Passwords do not match yet":"Repeat the password to confirm."}</small></div>
    {error&&<p className="err" role="alert">{error}</p>}
    <button className="btn pri auth-submit" disabled={!firebaseAuth||busy||!passwordMatches||password.length<8}>{busy?"Creating workspace…":"Create account"}</button>
    {firebaseAuth&&<button type="button" className="btn auth-google" disabled={busy} onClick={()=>void signInWithGoogle()}><GoogleMark/>Create with Google</button>}
    <div className="signup-foot"><button type="button" className="lnk acc" onClick={()=>{setMode("signin");setPassword("");setConfirmPassword("");setError("")}}>Already have an account? Sign in</button></div>
  </form>);

  return shell(<form className="auth-form auth-form-forgot" onSubmit={submitAuth}>
    {brand}<div className="mono auth-kicker">ACCOUNT RECOVERY</div><h1 className="auth-title">Reset your password.</h1><p className="auth-description">We’ll email you a secure reset link.</p>
    <div className="field"><label htmlFor="reset-email">Email</label><input id="reset-email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}/></div>
    {error&&<p className="err">{error}</p>}{info&&<p className="mute">{info}</p>}
    <button className="btn pri auth-submit" disabled={!firebaseAuth||busy}>{busy?"Sending…":"Send reset link"}</button>
    <button type="button" className="lnk acc auth-reset-back" onClick={()=>{setMode("signin");setError("");setInfo("")}}>Back to sign in</button>
  </form>);
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="17" height="17">
    <path fill="#4285F4" d="M17.64 9.2c0-.57-.05-1.12-.15-1.64H9v3.1h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.92c1.7-1.57 2.68-3.88 2.68-6.4Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.23c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.3A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.76a5.4 5.4 0 0 1 0-3.52v-2.3H.96a9 9 0 0 0 0 8.12l3.01-2.3Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A8.6 8.6 0 0 0 9 0a9 9 0 0 0-8.04 4.94l3.01 2.3C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>;
}
