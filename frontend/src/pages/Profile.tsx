import { useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { KeyRound, Save, ShieldCheck } from "lucide-react";
import { Card, CardHead, ErrorBox, PageHead, Skeleton } from "../components/ui";
import { useProfile, useSaveProfile } from "../hooks/data";
import { firebaseAuth } from "../lib/firebase";
import { toast } from "../lib/toast";

const ROLES: [string, string][] = [["school_student", "School student"], ["student", "College / university student"], ["working", "Working professional"], ["freelancer", "Freelancer"], ["entrepreneur", "Entrepreneur"], ["organization", "Organization"], ["educator", "Educator"], ["other", "Other"]];

export default function Profile() {
  const profile = useProfile();
  const save = useSaveProfile();
  const [f, setF] = useState({ display_name: "", username: "", age: "", role: "other" });
  const [resetBusy, setResetBusy] = useState(false);
  useEffect(() => {
    const p = profile.data;
    if (p) setF({ display_name: p.display_name ?? "", username: p.username ?? "", age: p.age ? String(p.age) : "", role: p.role ?? "other" });
  }, [profile.data]);

  const resetPassword = async () => {
    const email = profile.data?.email;
    if (!email || !firebaseAuth) {
      toast("Password reset is unavailable for this sign-in method.", "error");
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      toast("Password reset email sent. Check your inbox.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the reset email.", "error");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Profile" sub="Your account details and security" />
      {profile.isLoading ? <div className="g profile-page"><Card className="s7"><Skeleton rows={5} /></Card><Card className="s5"><Skeleton rows={3} /></Card></div> : profile.isError ? <ErrorBox error={profile.error} retry={() => void profile.refetch()} /> : <div className="g profile-page">
        <Card className="s7">
          <CardHead title="Personal information" />
          <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...f, age: Number(f.age) }); }}>
            <div className="fr">
              <div className="field"><label htmlFor="profile-name">Name</label><input id="profile-name" required maxLength={80} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
              <div className="field"><label htmlFor="profile-username">Username</label><input id="profile-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></div>
            </div>
            <div className="fr">
              <div className="field"><label htmlFor="profile-age">Age</label><input id="profile-age" type="number" min={13} max={120} required value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></div>
              <div className="field"><label htmlFor="profile-role">Role</label><select id="profile-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="profile-email">Email address</label><input id="profile-email" value={profile.data?.email ?? ""} disabled /></div>
            <button className="btn pri" disabled={save.isPending}><Save className="ic" />{save.isPending ? "Saving…" : "Save profile"}</button>
          </form>
        </Card>
        <Card className="s5">
          <CardHead title="Account security" />
          <div className="security-intro"><span className="security-icon"><ShieldCheck className="ic" /></span><div><b>Keep your account secure</b><p className="mute sm">Request a secure password reset link sent to your account email.</p></div></div>
          <div className="security-email">{profile.data?.email || "No email address available"}</div>
          <button className="btn" onClick={() => void resetPassword()} disabled={resetBusy || !profile.data?.email || !firebaseAuth}><KeyRound className="ic" />{resetBusy ? "Sending…" : "Send password reset link"}</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => save.mutate({ ...f, age: Number(f.age), tour_completed: false, onboarding_completed: true })}>Replay product tour</button>
          {!firebaseAuth && <p className="mute sm">Password reset is managed by your current authentication provider.</p>}
        </Card>
      </div>}
    </>
  );
}
