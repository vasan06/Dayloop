import { useEffect, useState } from "react";
import { Card, CardHead, PageHead } from "../components/ui";
import { applyTheme } from "../components/Shell";
import { useProfile, useSaveProfile } from "../hooks/data";

const ROLES: [string, string][] = [["school_student", "School student"], ["student", "College / university student"], ["working", "Working professional"], ["freelancer", "Freelancer"], ["entrepreneur", "Entrepreneur"], ["organization", "Organization"], ["educator", "Educator"], ["other", "Other"]];

export default function Settings() {
  const profile = useProfile();
  const save = useSaveProfile();
  const [f, setF] = useState({ display_name: "", username: "", age: "", role: "other" });
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("dl-theme") ?? "system"; } catch { return "system"; } });
  useEffect(() => { const p = profile.data; if (p) setF({ display_name: p.display_name ?? "", username: p.username ?? "", age: p.age ? String(p.age) : "", role: p.role ?? "other" }); }, [profile.data]);
  const pick = (t: string) => { setTheme(t); applyTheme(t); try { localStorage.setItem("dl-theme", t); } catch { /* ignore */ } };
  const err = save.error instanceof Error ? save.error.message : "";

  return (
    <>
      <PageHead title="Settings" sub="Profile and appearance" />
      <div className="g">
        <Card className="s7">
          <CardHead title="Profile" />
          <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...f, age: Number(f.age) }); }}>
            <div className="fr"><div className="field"><label htmlFor="s-name">Name</label><input id="s-name" required maxLength={80} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
              <div className="field"><label htmlFor="s-user">Username</label><input id="s-user" required pattern="[A-Za-z0-9_]{3,24}" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></div></div>
            <div className="fr"><div className="field"><label htmlFor="s-age">Age</label><input id="s-age" type="number" min={13} max={120} required value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></div>
              <div className="field"><label htmlFor="s-role">Role</label><select id="s-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
            <div className="field"><label>Email</label><input value={profile.data?.email ?? ""} disabled /></div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn pri" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</button>
          </form>
        </Card>
        <Card className="s5"><CardHead title="Appearance" /><div className="tabs">{["system", "light", "dark"].map((t) => <button key={t} className={theme === t ? "on" : ""} onClick={() => pick(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div><p className="mute sm">System follows your device. Your choice is saved in this browser.</p></Card>
      </div>
    </>
  );
}
