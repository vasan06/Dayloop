import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
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

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [localAccess, setLocalAccess] = useState(
    () => import.meta.env.DEV && window.localStorage.getItem("dayloop:local-access") === "true",
  );
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [register, setRegister] = useState(false);
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
    setBusy(true);
    try {
      if (register) {
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

  if (loading) {
    return <main className="auth-screen"><div className="auth-card">Connecting your secure workspace…</div></main>;
  }

  if (profileError && (user || localAccess)) {
    return <main className="auth-screen"><section className="auth-card">
      <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span className="brand-name">dayloop<span>.</span></span></div>
      <h1>Your workspace is waiting.</h1>
      <p className="auth-subtitle">We couldn’t load your profile from the DayLoop API.</p>
      <div className="api-warning">{profileError} Check that the backend and database are running, then try again.</div>
      <button className="primary-button auth-full-button" onClick={() => window.location.reload()}>Retry connection</button>
      <button className="auth-switch" onClick={() => void leaveWorkspace()}>Sign out</button>
    </section></main>;
  }

  if (user || localAccess) {
    if (!profileReady) {
      return <main className="auth-screen"><section className="auth-card profile-setup-card">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span className="brand-name">dayloop<span>.</span></span></div>
        <p className="section-kicker">YOUR ACCOUNT, YOUR WAY</p>
        <h1>Make this space yours.</h1>
        <p className="auth-subtitle">Add a few details so your workspace feels personal.</p>
        <form onSubmit={saveProfile}>
          <label>Name<input autoComplete="name" maxLength={80} required value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
          <label>Username<input autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value.toLowerCase() })} /><small>3–24 letters, numbers, or underscores.</small></label>
          <div className="profile-setup-grid">
            <label>Age<input type="number" min={13} max={120} required value={draft.age} onChange={(event) => setDraft({ ...draft, age: event.target.value })} /></label>
            <label>Role<select required value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option value="" disabled>Select your role</option>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-full-button" disabled={busy}>{busy ? "Saving…" : "Continue to DayLoop"}</button>
        </form>
        <button className="auth-switch" onClick={() => void leaveWorkspace()}>Sign out</button>
      </section></main>;
    }

    return <>{children}<button className="signout-button" onClick={() => void leaveWorkspace()}>Sign out</button></>;
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span className="brand-name">dayloop<span>.</span></span></div>
      <p className="section-kicker">A SPACE THAT MOVES WITH YOU</p>
      <h1>{register ? "Create your account." : "Welcome back."}</h1>
      <p className="auth-subtitle">Sign in to your private DayLoop workspace.</p>
      {!firebaseConfigured && <div className="api-warning">Firebase web authentication is not configured. Add your VITE_FIREBASE_* settings to frontend/.env. In local development, you can still connect to the backend below.</div>}
      <form onSubmit={submitAuth}>
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete={register ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-full-button" disabled={!firebaseAuth || busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
      </form>
      {firebaseAuth && <><div className="auth-divider"><span>or</span></div><button className="google-button" disabled={busy} onClick={() => void signInWithGoogle()}><GoogleMark /> Continue with Google</button></>}
      <button className="auth-switch" onClick={() => { setRegister((value) => !value); setError(""); }}>{register ? "Already have an account? Sign in" : "New to DayLoop? Create an account"}</button>
      {import.meta.env.DEV && <div className="local-access"><span>For local backend testing</span><button className="auth-switch" onClick={() => { window.localStorage.setItem("dayloop:local-access", "true"); setLocalAccess(true); setError(""); }}>Continue with local development identity</button></div>}
    </section>
  </main>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="17" height="17">
    <path fill="#4285F4" d="M17.64 9.2c0-.57-.05-1.12-.15-1.64H9v3.1h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.92c1.7-1.57 2.68-3.88 2.68-6.4Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.23c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.3A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.76a5.4 5.4 0 0 1 0-3.52v-2.3H.96a9 9 0 0 0 0 8.12l3.01-2.3Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A8.6 8.6 0 0 0 9 0a9 9 0 0 0-8.04 4.94l3.01 2.3C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>;
}
