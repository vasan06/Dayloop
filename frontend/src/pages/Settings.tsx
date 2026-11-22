import { useEffect, useState } from "react";
import { LayoutTemplate, Palette, Play, Type } from "lucide-react";
import { Card, CardHead, PageHead } from "../components/ui";
import OfflineRecovery from "../components/OfflineRecovery";
import { alertPermission, notificationSound, requestAlertPermission, setNotificationSound, showAlert, type NotificationSound } from "../lib/notifications";
import { toast } from "../lib/toast";
import { setTheme, useTheme } from "../hooks/useTheme";

type Preset = "default" | "paper" | "calm" | "mono" | "ocean" | "sunset";
type Density = "compact" | "comfortable" | "spacious";
type Motion = "full" | "subtle" | "reduce";

const PRESETS: Array<{ id: Preset; name: string; hint: string }> = [
  { id: "default", name: "DayLoop", hint: "Cobalt + cool neutral" },
  { id: "paper", name: "Paper", hint: "Warm editorial neutral" },
  { id: "calm", name: "Calm", hint: "Teal productivity" },
  { id: "ocean", name: "Ocean", hint: "Blue + cyan contrast" },
  { id: "sunset", name: "Sunset", hint: "Coral + amber warmth" },
  { id: "mono", name: "Mono", hint: "Monochrome workspace" },
];
const stored = <T extends string>(k:string,f:T):T=>{try{return(localStorage.getItem(k) as T)||f}catch{return f}};

export default function Settings(){
  const theme=useTheme();
  const [preset,setPreset]=useState<Preset>(()=>stored("dayloop:appearance-preset","default"));
  const [density,setDensity]=useState<Density>(()=>stored("dayloop:density","comfortable"));
  const [motion,setMotion]=useState<Motion>(()=>stored("dayloop:motion","full"));
  const [previewKey,setPreviewKey]=useState(0);
  const [sound,setSound]=useState<NotificationSound>(notificationSound);
  const [notificationTesting,setNotificationTesting]=useState(false);
  async function testNotification() {
    if (notificationTesting) return;
    setNotificationTesting(true);
    try {
      const permission = await alertPermission() === "granted" ? "granted" : await requestAlertPermission();
      if (permission !== "granted") throw new Error("Enable notifications for DayLoop in your Android or browser settings.");
      await showAlert("DayLoop test", "Notifications are configured for this device.", `dayloop-test:${Date.now()}`);
      toast("Test notification sent. Check the Android notification shade.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to send test notification.", "error");
    } finally {
      setNotificationTesting(false);
    }
  }

  useEffect(()=>{preset==="default"?document.documentElement.removeAttribute("data-preset"):document.documentElement.dataset.preset=preset;try{localStorage.setItem("dayloop:appearance-preset",preset)}catch{}},[preset]);
  useEffect(()=>{document.documentElement.dataset.density=density;try{localStorage.setItem("dayloop:density",density)}catch{}},[density]);
  useEffect(()=>{document.documentElement.dataset.motion=motion;try{localStorage.setItem("dayloop:motion",motion)}catch{};setPreviewKey((v)=>v+1)},[motion]);

  return <>
    <PageHead title="Settings" sub="Shape the workspace around how you like to work" />
    <div className="settings-layout">
      <OfflineRecovery />
      <Card className="settings-main">
        <CardHead title="Appearance" />
        <div className="settings-section">
          <div className="settings-label"><Palette className="ic"/><span><b>Color mode</b><small>Choose the surface mode. Every preset has a matching light and dark palette.</small></span></div>
          <div className="choice-grid three">{(["system","light","dark"] as const).map((item)=><button key={item} className={theme===item?"choice-card active":"choice-card"} onClick={()=>setTheme(item)}><i className={"theme-preview "+item}/><b>{item[0].toUpperCase()+item.slice(1)}</b></button>)}</div>
        </div>
        <div className="settings-section">
          <div className="settings-label"><Type className="ic"/><span><b>Workspace presets</b><small>Preset changes apply immediately and preserve the selected light/dark mode.</small></span></div>
          <div className="preset-grid">{PRESETS.map((item)=><button key={item.id} className={preset===item.id?"preset active":"preset"} onClick={()=>setPreset(item.id)}><i className={"preset-swatch "+item.id}/><span><b>{item.name}</b><small>{item.hint}</small></span><span className="preset-mini"><i/><i/><i/></span></button>)}</div>
        </div>
      </Card>

      <Card className="settings-side">
        <CardHead title="Interface behavior" />
        <div className="settings-section"><div className="settings-label"><span><b>Notification sound</b><small>Android notification channels may retain their sound choice until changed in system settings.</small></span></div><div className="row wrap" style={{ gap: 8 }}>{(["dayloop","system","silent"] as const).map((choice) => <button key={choice} className={sound === choice ? "btn pri sm" : "btn sm"} onClick={() => { setSound(choice); setNotificationSound(choice); }}>{choice === "dayloop" ? "DayLoop chime" : choice === "system" ? "System sound" : "Silent"}</button>)}</div>
          <button className="btn sm" type="button" onClick={() => void testNotification()} disabled={notificationTesting} style={{ marginTop: 12 }}>
            {notificationTesting ? "Testing…" : "Send test notification"}
          </button>
        </div>
        <div className="settings-section">
          <div className="settings-label"><LayoutTemplate className="ic"/><span><b>Density</b><small>See the difference before choosing it.</small></span></div>
          <div className="density-options">{(["compact","comfortable","spacious"] as Density[]).map((item)=><button key={item} onClick={()=>setDensity(item)} className={density===item?"density-choice active":"density-choice"}><span className={"density-preview "+item}><i/><i/><i/></span><b>{item[0].toUpperCase()+item.slice(1)}</b></button>)}</div>
        </div>
        <div className="settings-section">
          <div className="settings-label"><span><b>Motion</b><small>Full is expressive, Subtle keeps only useful transitions, Reduced removes almost all motion.</small></span></div>
          <div className="motion-options">{(["full","subtle","reduce"] as Motion[]).map((item)=><button key={item} className={motion===item?"motion-choice active":"motion-choice"} onClick={()=>setMotion(item)}><span className={"motion-dot "+item}/><b>{item==="reduce"?"Reduced":item[0].toUpperCase()+item.slice(1)}</b></button>)}</div>
          <button className="btn sm motion-replay" onClick={()=>setPreviewKey((v)=>v+1)}><Play className="ic"/>Replay motion</button>
          <div key={previewKey} className="motion-preview"><span/><span/><span/></div>
        </div>
      </Card>

      <Card className="settings-preview-card">
        <CardHead mono="LIVE PREVIEW" title="Workspace sample" />
        <div className="settings-live-preview">
          <aside><i/><i/><i/><i/></aside>
          <section><div className="preview-title"/><div className="preview-cards"><i/><i/><i/></div><div className="preview-row"/><div className="preview-row short"/></section>
        </div>
      </Card>
    </div>
  </>;
}
