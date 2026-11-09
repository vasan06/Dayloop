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
import { firebaseAuth, firebaseConfigured } from "../lib/firebase";

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
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
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
      setError(reason instanceof Error ? reason.message : "Google sign-in failed.");
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
  const brand = <div style={{ marginBottom: 28 }}><Logo light={false} /></div>;
  const shell = (content: ReactNode) => <main className="auth"><div className="l"><div className="fw">{content}</div></div><div className="r" aria-hidden="true"><div className="dev" style={{ width: 260 }}><div className="in"><div className="card tn-mint"><div className="mono">Streak</div><div className="big">12 days</div></div><div className="card"><div className="mono">Today</div><div className="pbar"><i style={{ width: "70%" }} /></div></div></div></div></div></main>;

  if (loading) return <div className="boot" role="status" aria-label="Loading"><div><div className="orbit"><i /><i /><i /></div><div className="bt">Opening your workspace</div><div className="msgs"><span>Connecting securely…</span><span>Syncing tasks…</span><span>Almost there…</span></div></div></div>;

  if (profileError && (user || localAccess)) {
    return shell(<>{brand}<h1>Can’t reach your workspace</h1><p className="mute">{profileError}</p><p className="mute sm">{profileError.startsWith("Network error:") ? "Check that the DayLoop API is running, then retry." : "Retry, or sign out and sign in again."}</p><button className="btn pri" onClick={() => window.location.reload()}>Retry connection</button><button className="btn ghost" onClick={() => void leaveWorkspace()}>Sign out</button></>);
  }

  if (user || localAccess) {
    if (!profileReady) {
      return shell(<form onSubmit={saveProfile}>{brand}<div className="mono">Your account, your way</div><h1 style={{ margin: "8px 0 6px" }}>Make this space yours.</h1><p className="mute" style={{ marginTop: 0 }}>A few details to personalise DayLoop.</p>
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
  return shell(<form onSubmit={submitAuth}>
    {brand}<h1 style={{ marginBottom: 6 }}>{titles[mode]}</h1>
    <p className="mute" style={{ marginTop: 0 }}>{mode === "forgot" ? "We’ll email you a reset link." : "Sign in to your private DayLoop workspace."}</p>
    {!firebaseConfigured && <div className="err" style={{ marginBottom: 14 }}>Firebase isn’t configured. Add your VITE_FIREBASE_* values to frontend/.env{import.meta.env.DEV ? " — or use the local development identity below." : "."}</div>}
    <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
    {mode !== "forgot" && <div className="field"><label htmlFor="a-pw">Password</label><div className="pw"><input id="a-pw" type={showPw ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)}>{showPw ? <EyeOff className="ic" /> : <Eye className="ic" />}</button></div>
      {register && <div className={`meter s${strength}`} aria-hidden="true"><i /><i /><i /><i /></div>}</div>}
    {error && <p className="err" role="alert">{error}</p>}{info && <p className="mute" role="status">{info}</p>}
    <button className="btn pri" disabled={!firebaseAuth || busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button>
    {firebaseAuth && mode !== "forgot" && <button type="button" className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => void signInWithGoogle()}><GoogleMark /> Continue with Google</button>}
    <div className="row sb sm" style={{ marginTop: 16 }}>
      <button type="button" className="lnk acc" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setInfo(""); }}>{mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}</button>
      {mode === "signin" ? <button type="button" className="lnk" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button> : <button type="button" className="lnk" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => { setMode("landing"); setError(""); }}>Back</button>}
    </div>
    {import.meta.env.DEV && <button type="button" className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => { window.localStorage.setItem("dayloop:local-access", "true"); setLocalAccess(true); setError(""); }}>Continue with local development identity</button>}
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
