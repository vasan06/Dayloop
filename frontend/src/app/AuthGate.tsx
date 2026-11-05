import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "../lib/firebase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setError("");
    try {
      if (register) await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      else await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    }
  }

  if (loading) return <main className="auth-screen"><div className="auth-card">Preparing your private workspace…</div></main>;
  if (user) return <>{children}<button className="signout-button" onClick={() => firebaseAuth && void signOut(firebaseAuth)}>Sign out</button></>;
  return <main className="auth-screen">
    <section className="auth-card">
      <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span className="brand-name">dayloop<span>.</span></span></div>
      <p className="section-kicker">A SPACE THAT MOVES WITH YOU</p>
      <h1>{register ? "Create your space." : "Welcome back."}</h1>
      <p className="auth-subtitle">A little more room for what matters.</p>
      {!firebaseConfigured && <div className="api-warning">Firebase is not configured. Add the VITE_FIREBASE_* values to the frontend environment before using production sign-in.</div>}
      <form onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete={register ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary-button" disabled={!firebaseAuth}>{register ? "Create account" : "Sign in"}</button>
      </form>
      <button className="auth-switch" onClick={() => { setRegister((value) => !value); setError(""); }}>{register ? "Already have an account? Sign in" : "New to DayLoop? Create an account"}</button>
    </section>
  </main>;
}
