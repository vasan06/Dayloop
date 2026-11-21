import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, History, LogOut, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { Logo } from "../components/Shell";
import "../styles/admin.css";

const API_BASE=(import.meta.env.VITE_API_URL||"/api/v1").replace(/\/+$/,"");
type Counts={users:number;active_sessions:number;tasks:number;habits:number;projects:number;notes:number;feedback:number};
type Point={day:string;users?:number;tasks?:number};
type UserRow={
  id:string;created_at:string;last_seen_at:string|null;admin_disabled:boolean;
  tasks_created:number;tasks_deleted:number;habits_created:number;habits_archived:number;
  projects_created:number;projects_archived:number;notes_created:number;notes_deleted:number;
};
type Feedback={id:string;message:string;page:string;created_at:string};
type Audit={id:string;action:string;target_type:string;target_id:string|null;detail:Record<string,unknown>;created_at:string};

async function adminFetch<T>(path:string,key:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set("X-DayLoop-Admin-Key",key);
  if(init.body)headers.set("Content-Type","application/json");
  const response=await fetch(`${API_BASE}/admin${path}`,{...init,headers});
  if(!response.ok){
    const body=await response.json().catch(()=>({}));
    throw new Error(body.detail||`Admin request failed (${response.status})`);
  }
  if(response.status===204)return undefined as T;
  return response.json();
}

function MiniBars({points,field}:{points:Point[];field:"users"|"tasks"}){
  const max=Math.max(1,...points.map((point)=>Number(point[field]||0)));
  return <div className="admin-bars">{points.map((point)=><div key={point.day} title={`${point.day}: ${point[field]||0}`}><i style={{height:`${Math.max(4,(Number(point[field]||0)/max)*100)}%`}}/><span>{new Date(point.day).getDate()}</span></div>)}</div>;
}

function MetricPair({created,removed,label}:{created:number;removed:number;label:string}){
  return <div className="activity-pair"><span><b>{created}</b><small>{label}</small></span><span><b>{removed}</b><small>{label==="Habits"||label==="Projects"?"archived":"deleted"}</small></span></div>;
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
        adminFetch<any>("/overview",key),
        adminFetch<any>("/users",key),
        adminFetch<any>("/feedback",key),
        adminFetch<any>("/audit",key),
      ]);
      setOverview(o);setUsers(u.items);setFeedback(f.items);setAudit(a.items);
      sessionStorage.setItem("dayloop:admin-key",key);setAdminKey(key);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Admin access failed");
      setOverview(null);
    }
  };
  useEffect(()=>{if(adminKey)void load(adminKey)},[]);
  const labels=useMemo(()=>new Map(users.map((user,index)=>[user.id,`User ${String(index+1).padStart(2,"0")}`])),[users]);

  const updateAccess=async(user:UserRow)=>{
    const result=await adminFetch<{item:{admin_disabled:boolean}}>(`/users/${user.id}`,adminKey,{method:"PATCH",body:JSON.stringify({admin_disabled:!user.admin_disabled})});
    setUsers((list)=>list.map((item)=>item.id===user.id?{...item,admin_disabled:result.item.admin_disabled}:item));
    const next=await adminFetch<{items:Audit[]}>("/audit",adminKey);setAudit(next.items);
  };

  if(!overview)return <main className="admin-login"><section>
    <Logo light={false}/>
    <div className="admin-login-copy"><div className="mono">DAYLOOP CONTROL</div><h1>Admin workspace</h1><p>Separate operational access for DayLoop usage metrics and feedback.</p></div>
    <form onSubmit={(event)=>{event.preventDefault();void load(draft)}}><label>Admin key<input type="password" autoFocus value={draft} onChange={(event)=>setDraft(event.target.value)}/></label>{error&&<p className="err">{error}</p>}<button>Open admin</button></form>
  </section></main>;

  const counts=overview.counts;
  const tabs=[["overview",BarChart3],["users",Users],["feedback",Activity],["audit",History]] as const;
  return <div className="admin-shell">
    <aside>
      <div className="admin-brand"><Logo light={false}/><small>CONTROL</small></div>
      <nav>{tabs.map(([name,Icon])=><button className={tab===name?"on":""} key={name} onClick={()=>setTab(name)}><Icon/>{name}</button>)}</nav>
      <button className="admin-logout" onClick={()=>{sessionStorage.removeItem("dayloop:admin-key");setAdminKey("");setOverview(null)}}><LogOut/>Log out</button>
    </aside>
    <main>
      <header><div><div className="mono">DAYLOOP ADMIN</div><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1></div><button className="admin-refresh" onClick={()=>void load()}><RefreshCw/>Refresh</button></header>

      {tab==="overview"&&<>
        <div className="admin-stats">{Object.entries(counts).map(([name,value])=><article key={name}><span>{name.replace("_"," ")}</span><b>{value}</b></article>)}</div>
        <div className="admin-grid"><section><h2>User creation · 14 days</h2><MiniBars points={overview.user_creations} field="users"/></section><section><h2>Task creation · 14 days</h2><MiniBars points={overview.task_creations} field="tasks"/></section></div>
      </>}

      {tab==="users"&&<div className="user-activity-list">{users.map((user,index)=><article key={user.id} className="user-activity-card">
        <div className="user-activity-head"><div><span className={user.last_seen_at&&Date.now()-new Date(user.last_seen_at).getTime()<15*60_000?"live-dot live":"live-dot"}/><b>{labels.get(user.id)}</b><small>Created {new Date(user.created_at).toLocaleDateString()} · {user.last_seen_at?`last active ${new Date(user.last_seen_at).toLocaleString()}`:"no recent activity"}</small></div><button className={user.admin_disabled?"admin-enable":"admin-disable"} onClick={()=>void updateAccess(user)}>{user.admin_disabled?"Enable":"Disable"}</button></div>
        <div className="user-activity-metrics">
          <MetricPair created={user.tasks_created} removed={user.tasks_deleted} label="Tasks"/>
          <MetricPair created={user.habits_created} removed={user.habits_archived} label="Habits"/>
          <MetricPair created={user.projects_created} removed={user.projects_archived} label="Projects"/>
          <MetricPair created={user.notes_created} removed={user.notes_deleted} label="Notes"/>
        </div>
      </article>)}</div>}

      {tab==="feedback"&&<div className="admin-feedback">{feedback.map((item,index)=><article key={item.id}><div><b>Feedback {String(index+1).padStart(2,"0")}</b><small>{new Date(item.created_at).toLocaleString()} · {item.page}</small></div><p>{item.message}</p><button aria-label="Delete feedback" onClick={async()=>{await adminFetch(`/feedback/${item.id}`,adminKey,{method:"DELETE"});setFeedback((list)=>list.filter((entry)=>entry.id!==item.id));}}><Trash2/></button></article>)}{!feedback.length&&<p className="admin-empty">No feedback yet.</p>}</div>}

      {tab==="audit"&&<div className="audit-list">{audit.map((item)=><article key={item.id}><time>{new Date(item.created_at).toLocaleString()}</time><b>{item.action} · {item.target_type}</b><small>{item.target_id&&labels.get(item.target_id)?labels.get(item.target_id):"System action"}</small></article>)}{!audit.length&&<p className="admin-empty">No admin actions yet.</p>}</div>}
    </main>
  </div>;
}
