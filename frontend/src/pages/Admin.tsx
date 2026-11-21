import { useEffect, useState } from "react";
import { BarChart3, History, LogOut, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import "../styles/admin.css";

const API_BASE=(import.meta.env.VITE_API_URL||"/api/v1").replace(/\/+$/,"");
type Counts={users:number;active_sessions:number;tasks:number;habits:number;projects:number;notes:number;feedback:number};
type Point={day:string;users?:number;tasks?:number};
type UserRow={id:string;email:string|null;username:string|null;role:string|null;created_at:string;last_seen_at:string|null;admin_disabled:boolean;tasks:number;habits:number;projects:number;notes:number};
type Feedback={id:string;message:string;page:string;created_at:string;email:string|null;username:string|null};
type Audit={id:string;action:string;target_type:string;target_id:string|null;detail:Record<string,unknown>;created_at:string};

async function adminFetch<T>(path:string,key:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers); headers.set("X-DayLoop-Admin-Key",key); if(init.body)headers.set("Content-Type","application/json");
  const response=await fetch(`${API_BASE}/admin${path}`,{...init,headers});
  if(!response.ok){const b=await response.json().catch(()=>({}));throw new Error(b.detail||`Admin request failed (${response.status})`)}
  if(response.status===204)return undefined as T;
  return response.json();
}

function MiniBars({points,field}:{points:Point[];field:"users"|"tasks"}){
  const max=Math.max(1,...points.map(p=>Number(p[field]||0)));
  return <div className="admin-bars">{points.map((p)=><div key={p.day} title={`${p.day}: ${p[field]||0}`}><i style={{height:`${Math.max(4,(Number(p[field]||0)/max)*100)}%`}}/><span>{new Date(p.day).getDate()}</span></div>)}</div>
}

export default function Admin(){
  const [adminKey,setAdminKey]=useState(()=>sessionStorage.getItem("dayloop:admin-key")||"");
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [overview,setOverview]=useState<{counts:Counts;user_creations:Point[];task_creations:Point[]}|null>(null);
  const [users,setUsers]=useState<UserRow[]>([]);
  const [feedback,setFeedback]=useState<Feedback[]>([]);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [tab,setTab]=useState<"overview"|"users"|"feedback"|"audit">("overview");

  const load=async(key=adminKey)=>{
    setError("");
    try{
      const [o,u,f,a]=await Promise.all([
        adminFetch<any>("/overview",key),adminFetch<any>("/users",key),
        adminFetch<any>("/feedback",key),adminFetch<any>("/audit",key),
      ]);
      setOverview(o);setUsers(u.items);setFeedback(f.items);setAudit(a.items);
      sessionStorage.setItem("dayloop:admin-key",key);setAdminKey(key);
    }catch(e){setError(e instanceof Error?e.message:"Admin access failed");setOverview(null)}
  };
  useEffect(()=>{if(adminKey)void load(adminKey)},[]);

  const updateUser=async(id:string,payload:Record<string,unknown>)=>{
    const result=await adminFetch<{item:Partial<UserRow>}>(`/users/${id}`,adminKey,{method:"PATCH",body:JSON.stringify(payload)});
    setUsers((list)=>list.map((u)=>u.id===id?{...u,...result.item}:u));
    const a=await adminFetch<{items:Audit[]}>("/audit",adminKey);setAudit(a.items);
  };

  if(!overview)return <main className="admin-login"><section>
    <span className="admin-mark"><ShieldCheck/></span><div className="mono">DAYLOOP CONTROL</div>
    <h1>Administrator access</h1><p>This portal is separate from user authentication and requires the DayLoop admin key.</p>
    <form onSubmit={(e)=>{e.preventDefault();void load(draft)}}><label>Admin key<input type="password" autoFocus value={draft} onChange={(e)=>setDraft(e.target.value)}/></label>{error&&<p className="err">{error}</p>}<button>Open control center</button></form>
  </section></main>;

  const c=overview.counts;
  const tabs=[["overview",BarChart3],["users",Users],["feedback",ShieldCheck],["audit",History]] as const;
  return <div className="admin-shell">
    <aside><div><ShieldCheck/><b>DayLoop Admin</b></div>
      {tabs.map(([t,Icon])=><button className={tab===t?"on":""} key={t} onClick={()=>setTab(t)}><Icon/>{t}</button>)}
      <button onClick={()=>{sessionStorage.removeItem("dayloop:admin-key");setAdminKey("");setOverview(null)}}><LogOut/>Log out</button>
    </aside>
    <main>
      <header><div><div className="mono">CONTROL CENTER</div><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1></div><button className="admin-refresh" onClick={()=>void load()}><RefreshCw/>Refresh</button></header>
      {tab==="overview"&&<><div className="admin-stats">{Object.entries(c).map(([k,v])=><article key={k}><span>{k.replace("_"," ")}</span><b>{v}</b></article>)}</div><div className="admin-grid"><section><h2>User creations · 14 days</h2><MiniBars points={overview.user_creations} field="users"/></section><section><h2>Task activity · 14 days</h2><MiniBars points={overview.task_creations} field="tasks"/></section></div></>}
      {tab==="users"&&<section className="admin-table"><table><thead><tr><th>User</th><th>Role</th><th>Created</th><th>Last seen</th><th>Tasks</th><th>Habits</th><th>Projects</th><th>Notes</th><th>Access</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.username||"—"}</b><small>{u.email}</small></td><td><select value={u.role||"other"} onChange={(e)=>void updateUser(u.id,{role:e.target.value})}>{["school_student","student","working","freelancer","entrepreneur","organization","educator","other"].map(r=><option key={r} value={r}>{r.replace("_"," ")}</option>)}</select></td><td>{new Date(u.created_at).toLocaleDateString()}</td><td>{u.last_seen_at?new Date(u.last_seen_at).toLocaleString():"—"}</td><td>{u.tasks}</td><td>{u.habits}</td><td>{u.projects}</td><td>{u.notes}</td><td><button className={u.admin_disabled?"admin-enable":"admin-disable"} onClick={()=>void updateUser(u.id,{admin_disabled:!u.admin_disabled})}>{u.admin_disabled?"Enable":"Disable"}</button></td></tr>)}</tbody></table></section>}
      {tab==="feedback"&&<div className="admin-feedback">{feedback.map(f=><article key={f.id}><div><b>{f.username||f.email||"User"}</b><small>{new Date(f.created_at).toLocaleString()} · {f.page}</small></div><p>{f.message}</p><button aria-label="Delete feedback" onClick={async()=>{await adminFetch(`/feedback/${f.id}`,adminKey,{method:"DELETE"});setFeedback(x=>x.filter(i=>i.id!==f.id));const a=await adminFetch<{items:Audit[]}>("/audit",adminKey);setAudit(a.items)}}><Trash2/></button></article>)}{!feedback.length&&<p>No feedback yet.</p>}</div>}
      {tab==="audit"&&<section className="admin-table"><table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>ID</th><th>Detail</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.action}</td><td>{a.target_type}</td><td>{a.target_id||"—"}</td><td><code>{JSON.stringify(a.detail)}</code></td></tr>)}</tbody></table></section>}
    </main>
  </div>;
}
