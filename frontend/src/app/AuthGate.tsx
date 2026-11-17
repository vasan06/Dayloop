import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import Landing from "./Landing";
import { Logo } from "../components/Shell";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { apiRequest } from "../lib/api";
import { firebaseAuth, firebaseConfigured, firebaseMissingConfig } from "../lib/firebase";

type Profile = {
  email: string | null;
  display_name: string | null;
  username: string | null;
  age: number | null;
  role: string | null;
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

type Mode = "landing" | "signin" | "signup" | "forgot";

export default function AuthGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [localAccess, setLocalAccess] = useState(
    () => import.meta.env.DEV && window.localStorage.getItem("dayloop:local-access") === "true",
  );
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [mode, setMode] = useState<Mode>("landing");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [demoView, setDemoView] = useState<"tasks" | "habits" | "focus" | "finance">("tasks");
  const [info, setInfo] = useState("");
  const register = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkProfile(displayName = "") {
      setLoading(true);
      setProfileError("");
      try {
        const response = await apiRequest<{ item: Profile | null }>("/profile");
        if (!active) return;
        const profile = response.item;
        const complete = Boolean(profile?.username && profile.age && profile.role);
        setProfileReady(complete);
        setDraft({
          display_name: profile?.display_name || displayName,
          username: profile?.username || "",
          age: profile?.age ? String(profile.age) : "",
          role: profile?.role || "",
        });
      } catch (reason) {
        if (active) {
          setProfileError(reason instanceof Error ? reason.message : "Could not load your profile.");
        }
      } finally {
        if (active) setLoading(false);
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
      setUser(nextUser);
      setError("");
      if (nextUser) {
        void checkProfile(nextUser.displayName ?? "");
      } else if (localAccess) {
        void checkProfile();
      } else {
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
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } else {
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
      const provider = new GoogleAuthProvider();
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await signInWithRedirect(firebaseAuth, provider);
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
          display_name: draft.display_name.trim(),
          username: draft.username.trim(),
          age: Number(draft.age),
          role: draft.role,
        }),
      });
      setProfileReady(true);
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
    if (localAccess) {
      window.localStorage.removeItem("dayloop:local-access");
      setLocalAccess(false);
      setProfileReady(false);
    }
  }

  const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const passwordMatches = confirmPassword.length > 0 && password === confirmPassword;
  useEffect(() => {
    if (loading) document.title = "Loading · DayLoop";
    else if (user || localAccess) { if (!profileReady) document.title = "Complete profile · DayLoop"; }
    else document.title = mode === "landing" ? "DayLoop" : mode === "signin" ? "Sign in · DayLoop" : mode === "signup" ? "Create account · DayLoop" : "Reset password · DayLoop";
  }, [loading, user, localAccess, profileReady, mode]);
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
    <main className="auth auth-v2">
      <section className="l">
        <div className="fw">{content}</div>
      </section>
      <aside className="r auth-demo" aria-label="Interactive DayLoop product demonstration">
        <div className="auth-aside-top"><Logo /><span className="mono">A calmer way to keep life moving</span></div>
        <div className="auth-aside-content">
          <div className="auth-preview-heading">
            <div><span className="mono">A QUICK LOOK INSIDE DAYLOOP</span><h2>Make room for what matters.</h2><p>One connected workspace for the moving parts of your day.</p></div>
            <span className="auth-live"><i /> PRODUCT TOUR</span>
          </div>
          <div className="auth-demo-tabs" role="tablist" aria-label="Explore DayLoop features">
            {([["tasks","Tasks"],["habits","Habits"],["focus","Focus"],["finance","Finance"]] as const).map(([key,label]) => <button type="button" role="tab" aria-selected={demoView===key} className={demoView===key?"active":""} key={key} onClick={()=>setDemoView(key)}>{label}</button>)}
          </div>
          <div className="auth-demo-stage" role="tabpanel">
            {demoView === "tasks" && <div className="demo-task-view"><div className="demo-stage-top"><span>MONDAY · MY DAY</span><b>4 of 6 done</b></div><div className="demo-progress-track"><i style={{width:"67%"}} /></div>{[["Review project brief","09:30","done"],["Plan the week","10:15","done"],["Design exploration","11:00","active"],["Team check-in","14:00","pending"]].map(([name,time,state])=><div className={"demo-task "+state} key={name}><span className="demo-check">{state==="done"?"✓":state==="active"?"↗":""}</span><b>{name}</b><small>{time}</small></div>)}</div>}
            {demoView === "habits" && <div className="demo-habit-view"><div className="demo-stage-top"><span>WEEKLY CONSISTENCY</span><b>82%</b></div><div className="demo-habit-bars">{[82,100,65,92,75,48,0].map((value,index)=><div key={index}><i style={{height:value+"%"}} /><small>{"MTWTFSS"[index]}</small></div>)}</div><div className="demo-habit-foot"><span><i /> Reading · 12 day streak</span><strong>Keep it going</strong></div></div>}
            {demoView === "focus" && <div className="demo-focus-view"><span className="demo-focus-label">A LITTLE SPACE TO THINK</span><div className="demo-focus-clock">25:00</div><p>One task. One clear mind.</p><div className="demo-focus-dots"><i /><i /><i /><i /></div><span className="demo-focus-chip">FOCUS SESSION · 01</span></div>}
            {demoView === "finance" && <div className="demo-finance-view"><div className="demo-stage-top"><span>MONTHLY OVERVIEW</span><b>On budget</b></div><strong className="demo-balance">₹24,800</strong><small>Available this month</small><div className="demo-finance-track"><i /><i /><i /></div><div className="demo-finance-legend"><span><i /> Essentials <b>52%</b></span><span><i /> Lifestyle <b>30%</b></span><span><i /> Savings <b>18%</b></span></div></div>}
          </div>
          <div className="auth-demo-foot"><span className="auth-note-mark"><Logo light={false} /></span><div><b>One workspace. Your whole day.</b><small>Explore the real tools once you’re inside.</small></div><span className="demo-pagination">{["tasks","habits","focus","finance"].indexOf(demoView)+1} / 4</span></div>
        </div>
        <p className="auth-aside-footer">Plan with intention. Make progress visible.</p>
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
        <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" autoComplete="name" maxLength={80} required value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="p-user">Username</label><input id="p-user" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.toLowerCase() })} /></div>
        <div className="fr"><div className="field"><label htmlFor="p-age">Age</label><input id="p-age" type="number" min={13} max={120} required value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} /></div>
          <div className="field"><label htmlFor="p-role">Role</label><select id="p-role" required value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}><option value="" disabled>Select</option>{roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn pri" disabled={busy}>{busy ? "Saving…" : "Continue to DayLoop"}</button>
        <button type="button" className="btn ghost" onClick={() => void leaveWorkspace()}>Sign out</button></form>);
    }
    return <>{children(() => void leaveWorkspace())}</>;
  }

  if (mode === "landing") return <Landing onSignIn={() => setMode("signin")} onSignUp={() => setMode("signup")} />;

  const titles = { signin: "Welcome back.", signup: "Create your account.", forgot: "Reset your password." } as const;
  return shell(<form className="auth-form" onSubmit={submitAuth}>
    {brand}<div className="mono auth-kicker">{mode === "signup" ? "START YOUR DAYLOOP" : mode === "forgot" ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</div><h1 className="auth-title">{titles[mode]}</h1>
    <p className="auth-description">{mode === "forgot" ? "We’ll email you a secure link to reset your password." : mode === "signup" ? "Create one account for your plans, habits and progress." : "Sign in to pick up right where you left off."}</p>
    {!firebaseConfigured && <div className="auth-config-warning" role="alert"><b>Firebase isn’t available in this Vite session.</b><span>Missing environment values: {firebaseMissingConfig.join(", ") || "Firebase could not be initialised"}.</span><small>After updating frontend/.env, restart the frontend server. You can still use the local development identity below.</small></div>}
    <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
    {mode !== "forgot" && <>
      <div className="field auth-password-field"><label htmlFor="a-pw">Password</label><div className="pw"><input id="a-pw" type={showPw ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : 6} required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff className="ic" /> : <Eye className="ic" />}</button></div>
        {register && <div className="auth-strength"><div className={`meter s${strength}`} aria-hidden="true"><i /><i /><i /><i /></div><small>{strength < 2 ? "Use 8+ characters and mix letter types" : strength < 4 ? "Good start — add a number or symbol" : "Strong password"}</small></div>}</div>
      {register && <div className="field auth-password-field"><label htmlFor="a-confirm-pw">Confirm password</label><div className={`pw ${confirmPassword ? passwordMatches ? "is-match" : "is-mismatch" : ""}`}><input id="a-confirm-pw" type={showConfirmPw ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} aria-invalid={confirmPassword.length > 0 && !passwordMatches} aria-describedby="password-match-hint" onChange={(e) => setConfirmPassword(e.target.value)} /><button type="button" aria-label={showConfirmPw ? "Hide confirmation password" : "Show confirmation password"} onClick={() => setShowConfirmPw((s) => !s)}>{showConfirmPw ? <EyeOff className="ic" /> : <Eye className="ic" />}</button></div><small id="password-match-hint" className={confirmPassword ? passwordMatches ? "auth-match-good" : "auth-match-bad" : "auth-match-neutral"}>{confirmPassword ? passwordMatches ? "Passwords match" : "Passwords do not match yet" : "Enter the same password again to confirm."}</small></div>}
    </>}
    {error && <p className="err" role="alert">{error}</p>}{info && <p className="mute" role="status">{info}</p>}
    <button className="btn pri auth-submit" disabled={!firebaseAuth || busy || (register && (!passwordMatches || password.length < 8))}>{busy ? "Please wait…" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Send reset link" : "Sign in to DayLoop"}</button>
    {firebaseAuth && mode !== "forgot" && <button type="button" className="btn auth-google" disabled={busy} onClick={() => void signInWithGoogle()}><GoogleMark /> Continue with Google</button>}
    <div className="row sb sm auth-links">
      {mode === "forgot" ? (
        <button type="button" className="lnk acc" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode("signin"); setError(""); setInfo(""); }}>Back to sign in</button>
      ) : (
        <button type="button" className="lnk acc" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setPassword(""); setConfirmPassword(""); setShowPw(false); setShowConfirmPw(false); setError(""); setInfo(""); }}>{mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}</button>
      )}
      {mode === "signin" && <button type="button" className="lnk" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}>Forgot password?</button>}
      {mode === "signup" && <button type="button" className="lnk" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode("landing"); setError(""); }}>Back to DayLoop</button>}
    </div>
    {import.meta.env.DEV && (
      <>
        <div className="auth-divider"><span>OR</span></div>
        <button type="button" className="btn auth-local" onClick={() => { window.localStorage.setItem("dayloop:local-access", "true"); setLocalAccess(true); setError(""); }}>
          <span className="auth-local-dot" /> Continue with local development identity
        </button>
      </>
    )}
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
