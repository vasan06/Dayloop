import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Download, ShieldCheck } from "lucide-react";
import { Modal } from "./ui";

type Release = {version_code:number;version_name:string;product_build?:number;apk_url:string;sha256:string;notes:string;force_update:boolean;min_supported_code:number};
type NativeUpdater = {
  canInstall(): Promise<{allowed:boolean}>;
  openInstallSettings(): Promise<void>;
  downloadAndVerify(options:{url:string;sha256:string;versionCode:number}):Promise<void>;
  installApk(options:{sha256:string;versionCode:number}):Promise<void>;
  addListener(event:"progress", callback:(p:{received:number;total:number})=>void):Promise<PluginListenerHandle>;
};
const updater = registerPlugin<NativeUpdater>("DayLoopUpdater");
const repository = String(import.meta.env.VITE_RELEASE_REPOSITORY || "vasan06/DayLoop");
const endpoint = "https://api.github.com/repos/" + repository + "/releases/latest";
const checkInterval = 6 * 60 * 60 * 1000;
export function eligibleRelease(row:Release, current:number, origin:string): boolean {
  try {
    const url=new URL(row.apk_url), base=new URL(origin);
    return Number.isSafeInteger(row.version_code)&&row.version_code>current &&
      typeof row.version_name==="string" && typeof row.notes==="string" &&
      /^[a-f0-9]{64}$/i.test(row.sha256)&&url.protocol==="https:"&&url.origin===base.origin &&
      url.pathname.startsWith(base.pathname.replace(/\/$/,"")+"/releases/download/") && url.pathname.endsWith("/DayLoop.apk")&&!url.username&&!url.password &&
      Number.isSafeInteger(row.min_supported_code)&&row.min_supported_code>0&&row.min_supported_code<=row.version_code;
  } catch {return false;}
}

export default function AndroidUpdate() {
  const [release,setRelease]=useState<Release|null>(null),[current,setCurrent]=useState(0);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState<number|null>(null),[error,setError]=useState("");
  const [ready,setReady]=useState(false);
  const dismissed=useRef(0),checking=useRef(false),running=useRef(false),lastCheck=useRef(0);
  useEffect(()=>{
    if(Capacitor.getPlatform()!=="android"||!/^[-\w.]+\/[-\w.]+$/.test(repository))return;
    let alive=true;let resume:PluginListenerHandle|undefined,listener:PluginListenerHandle|undefined;
    async function check(){
      if(!alive||checking.current||running.current||Date.now()-lastCheck.current<checkInterval)return;
      checking.current=true;lastCheck.current=Date.now();
      try {
        const info=await App.getInfo(), code=Number(info.build);
        if(!Number.isSafeInteger(code)||code<1)return;
        const response=await fetch(endpoint,{headers:{Accept:"application/vnd.github+json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error("Update check unavailable");
        const published=await response.json();
        if(published.draft||published.prerelease||typeof published.body!=="string")return;
        const prefix="<!-- dayloop-update: ";
        const start=published.body.lastIndexOf(prefix);
        const end=published.body.indexOf(" -->",start+prefix.length);
        if(start<0||end<0)return;
        const next:Release=JSON.parse(published.body.slice(start+prefix.length,end));
        if(!published.assets?.some((a:{name:string;browser_download_url:string})=>a.name==="DayLoop.apk"&&a.browser_download_url===next.apk_url))return;
        if(alive&&next&&eligibleRelease(next,code,"https://github.com/"+repository)&&(next.version_code>dismissed.current||next.force_update||code<next.min_supported_code)){
          setCurrent(code);setRelease(old=>old?.version_code===next.version_code?old:next);
        }
      }catch{/* Offline checks must never block normal app use. */}
      finally{checking.current=false;}
    }
    void check();
    void App.addListener("resume",()=>{void check();}).then(h=>alive?resume=h:void h.remove());
    void updater.addListener("progress",p=>{if(alive)setProgress(p.total>0?Math.min(100,Math.round(p.received/p.total*100)):null);}).then(h=>alive?listener=h:void h.remove());
    return()=>{alive=false;void resume?.remove();void listener?.remove();};
  },[]);
  if(!release)return null;
  const mandatory=release.force_update||current<release.min_supported_code;
  function close(){if(!mandatory&&!busy){dismissed.current=release!.version_code;setRelease(null);setReady(false);setError("");}}
  async function update(){
    if(!release||running.current)return;
    running.current=true;setBusy(true);setError("");
    try {
      if(!(await updater.canInstall()).allowed){
        setError("Allow DayLoop to install updates in Android settings, then return and tap Update now.");
        await updater.openInstallSettings();return;
      }
      const params={sha256:release.sha256,versionCode:release.version_code};
      if(!ready){setProgress(0);await updater.downloadAndVerify({...params,url:release.apk_url});setReady(true);}
      await updater.installApk(params);
    }catch(e){setReady(false);setError(e instanceof Error?e.message:String(e));}
    finally{running.current=false;setBusy(false);}
  }
  return <Modal title="DayLoop update available" onClose={close}>
    <div className="release-history">
      <div className="release-hero"><Download size={24}/><h2>{release.version_name}</h2><span>Build {current} → {release.version_code}</span></div>
      <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{release.notes||"A new version is available."}</div>
      <div className="row"><ShieldCheck size={18}/><small>Verified package, checksum and signing certificate. Your data is preserved by Android's in-place update.</small></div>
      {busy&&<div role="status"><progress max={100} value={progress??undefined} style={{width:"100%"}}/>{progress===null?"Downloading…":progress+"%"}</div>}
      {error&&<p role="alert">{error}</p>}
      <div className="row" style={{justifyContent:"flex-end"}}>{!mandatory&&<button className="btn ghost" disabled={busy} onClick={close}>Later</button>}<button className="btn pri" disabled={busy} onClick={()=>void update()}>{busy?"Verifying…":ready?"Install update":"Update now"}</button></div>
    </div>
  </Modal>;
}
