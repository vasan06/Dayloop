import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, BellRing, Flag, Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { Card, CardHead, PageHead, Seg } from "../components/ui";
import { toast } from "../lib/toast";

type Mode = "focus" | "stopwatch" | "alarm";
type AlertState = { title: string; body: string } | null;
type Lap = { id: number; total: number; split: number };

const key = (name: string) => `dayloop:focus:${name}`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmt = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), s = safe % 60;
  return h ? [h,m,s].map((n)=>String(n).padStart(2,"0")).join(":") : [m,s].map((n)=>String(n).padStart(2,"0")).join(":");
};
const getNum = (name: string, fallback = 0) => { try { return Number(localStorage.getItem(key(name)) || fallback); } catch { return fallback; } };
const setVal = (name: string, value: string | number | null) => { try { value == null ? localStorage.removeItem(key(name)) : localStorage.setItem(key(name), String(value)); } catch {} };

async function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") { toast(`${title}: ${body}`); return; }
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, tag: "dayloop-focus", requireInteraction: true });
      return;
    }
    new Notification(title, { body, tag: "dayloop-focus" });
  } catch { try { new Notification(title, { body }); } catch { toast(`${title}: ${body}`); } }
}

export default function Focus() {
  const [mode, setMode] = useState<Mode>("focus");
  const [minutes, setMinutes] = useState(() => getNum("minutes", 25));
  const [focusEnd, setFocusEnd] = useState(() => getNum("end", 0));
  const [remaining, setRemaining] = useState(() => focusEnd ? Math.max(0, Math.ceil((focusEnd-Date.now())/1000)) : minutes*60);
  const [focusRunning, setFocusRunning] = useState(() => focusEnd > Date.now());
  const [elapsedBase, setElapsedBase] = useState(() => getNum("stopwatch-base", 0));
  const [stopwatchStart, setStopwatchStart] = useState(() => getNum("stopwatch-start", 0));
  const [elapsed, setElapsed] = useState(elapsedBase + (stopwatchStart ? Math.floor((Date.now()-stopwatchStart)/1000) : 0));
  const [laps, setLaps] = useState<Lap[]>(() => { try { return JSON.parse(localStorage.getItem(key("laps")) || "[]"); } catch { return []; } });
  const [alarmTime, setAlarmTime] = useState(() => localStorage.getItem(key("alarm-time")) || "09:00");
  const [alarmArmed, setAlarmArmed] = useState(() => localStorage.getItem(key("alarm-armed")) === "1");
  const [snoozedUntil, setSnoozedUntil] = useState(() => getNum("snooze", 0));
  const [alert, setAlert] = useState<AlertState>(null);
  const [focusedSeconds, setFocusedSeconds] = useState(() => getNum(`total:${todayKey()}`, 0));
  const fired = useRef("");

  const fire = (title: string, body: string) => { setAlert({ title, body }); void notify(title, body); };

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (focusRunning && focusEnd) {
        const left = Math.max(0, Math.ceil((focusEnd-Date.now())/1000));
        setRemaining(left);
        if (!left) {
          setFocusRunning(false); setFocusEnd(0); setVal("end", null);
          setFocusedSeconds((v) => v + minutes*60);
          fire("Focus complete", `${minutes} focused minutes finished.`);
        }
      }
      if (stopwatchStart) setElapsed(elapsedBase + Math.floor((Date.now()-stopwatchStart)/1000));
      if (snoozedUntil && Date.now() >= snoozedUntil) {
        setSnoozedUntil(0); setVal("snooze", null); fire("Snoozed reminder", "Your DayLoop reminder is due now.");
      }
      if (alarmArmed) {
        const now = new Date(), [hour, minute] = alarmTime.split(":").map(Number);
        const stamp = `${todayKey()}-${alarmTime}`;
        if (now.getHours()===hour && now.getMinutes()===minute && fired.current!==stamp) {
          fired.current=stamp; setAlarmArmed(false); setVal("alarm-armed", null); fire("DayLoop alarm", `Alarm for ${alarmTime}`);
        }
      }
    }, 500);
    return () => clearInterval(tick);
  }, [focusRunning, focusEnd, minutes, stopwatchStart, elapsedBase, snoozedUntil, alarmArmed, alarmTime]);

  useEffect(()=>setVal(`total:${todayKey()}`, focusedSeconds),[focusedSeconds]);
  useEffect(()=>{ try { localStorage.setItem(key("laps"), JSON.stringify(laps)); } catch {} },[laps]);

  const progress = useMemo(()=>minutes ? Math.max(0,Math.min(100,(1-remaining/(minutes*60))*100)) : 0,[minutes,remaining]);

  const startFocus = () => {
    if (remaining===0) setRemaining(minutes*60);
    if (focusRunning) {
      setFocusRunning(false); setFocusEnd(0); setVal("end", null);
    } else {
      const duration = remaining===0 ? minutes*60 : remaining;
      const end = Date.now()+duration*1000; setFocusEnd(end); setVal("end",end); setFocusRunning(true);
    }
  };
  const resetFocus = () => { setFocusRunning(false); setFocusEnd(0); setVal("end",null); setRemaining(minutes*60); };
  const updateMinutes = (value:number) => { const next=Math.max(1,Math.min(240,value||1)); setMinutes(next); setVal("minutes",next); setFocusRunning(false); setFocusEnd(0); setVal("end",null); setRemaining(next*60); };
  const toggleStopwatch = () => {
    if (stopwatchStart) {
      const total=elapsedBase+Math.floor((Date.now()-stopwatchStart)/1000); setElapsedBase(total); setElapsed(total); setStopwatchStart(0); setVal("stopwatch-base",total); setVal("stopwatch-start",null);
    } else { const now=Date.now(); setStopwatchStart(now); setVal("stopwatch-start",now); }
  };
  const resetStopwatch=()=>{setElapsedBase(0);setElapsed(0);setStopwatchStart(0);setLaps([]);setVal("stopwatch-base",null);setVal("stopwatch-start",null);};
  const addLap=()=>{const previous=laps[0]?.total??0; setLaps((list)=>[{id:Date.now(),total:elapsed,split:elapsed-previous},...list]);};
  const snooze=(mins:number)=>{const until=Date.now()+mins*60_000;setSnoozedUntil(until);setVal("snooze",until);setAlert(null);void notify("Reminder snoozed",`We'll notify you again in ${mins} minutes.`);};

  return <>
    <PageHead title="Focus" sub="Timer, stopwatch, laps and alarms that stay active while you move around DayLoop">
      <Seg value={mode} options={[[ "focus","Timer" ],[ "stopwatch","Stopwatch" ],[ "alarm","Alarm" ]]} onChange={setMode}/>
    </PageHead>
    <div className="g focus-page">
      <Card className="s8 focus-main-card">
        <CardHead mono={mode.toUpperCase()} title={mode==="focus"?"Focus timer":mode==="stopwatch"?"Stopwatch":"Alarm"}/>
        {mode==="focus" && <>
          <div className="focus-clock">{fmt(remaining)}</div><div className="focus-progress"><i style={{width:`${progress}%`}}/></div>
          <div className="focus-duration-row">{[15,25,45,60].map((v)=><button key={v} className={minutes===v?"focus-chip active":"focus-chip"} onClick={()=>updateMinutes(v)}>{v}m</button>)}<label className="focus-custom"><span>Custom</span><input type="number" min={1} max={240} value={minutes} onChange={(e)=>updateMinutes(Number(e.target.value))}/></label></div>
          <div className="focus-actions"><button className="btn pri" onClick={startFocus}>{focusRunning?<Pause className="ic"/>:<Play className="ic"/>}{focusRunning?"Pause":"Start"}</button><button className="btn" onClick={resetFocus}><RotateCcw className="ic"/>Reset</button></div>
        </>}
        {mode==="stopwatch" && <>
          <div className="focus-clock">{fmt(elapsed)}</div>
          <div className="focus-actions"><button className="btn pri" onClick={toggleStopwatch}>{stopwatchStart?<Pause className="ic"/>:<Play className="ic"/>}{stopwatchStart?"Pause":"Start"}</button><button className="btn" disabled={!elapsed} onClick={addLap}><Flag className="ic"/>Lap {laps.length+1}</button><button className="btn" onClick={resetStopwatch}><RotateCcw className="ic"/>Reset</button>{elapsed>0&&<button className="btn" onClick={()=>{setFocusedSeconds((v)=>v+elapsed);resetStopwatch();toast("Stopwatch time added to today.");}}>Log time</button>}</div>
          <div className="lap-list">{laps.map((lap,index)=><div key={lap.id}><span>Lap {laps.length-index}</span><b>{fmt(lap.split)}</b><small>{fmt(lap.total)} total</small></div>)}{!laps.length&&<p className="mute sm">Use Lap while the stopwatch is running to compare intervals.</p>}</div>
        </>}
        {mode==="alarm" && <>
          <div className="alarm-face"><AlarmClock/><input type="time" value={alarmTime} onChange={(e)=>{setAlarmTime(e.target.value);localStorage.setItem(key("alarm-time"),e.target.value);setAlarmArmed(false);setVal("alarm-armed",null);}}/></div>
          <div className="focus-actions"><button className={alarmArmed?"btn pri":"btn"} onClick={()=>{const next=!alarmArmed;setAlarmArmed(next);setVal("alarm-armed",next?"1":null);}}>{alarmArmed?"Alarm armed":"Set alarm"}</button></div>
          {snoozedUntil>0&&<p className="mute sm">Snoozed until {new Date(snoozedUntil).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>}
        </>}
      </Card>
      <Card className="s4"><CardHead title="Today"/><div className="focus-stat"><TimerReset/><span><b>{(focusedSeconds/3600).toFixed(1)} h</b><small>Focused today</small></span></div><div className="focus-stat"><BellRing/><span><b>Background alerts</b><small>Timer/alarm notifications use the registered DayLoop service worker when available.</small></span></div></Card>
    </div>
    {alert&&<div className="focus-alert-backdrop"><div className="focus-alert"><span className="focus-alert-icon"><BellRing/></span><h2>{alert.title}</h2><p>{alert.body}</p><div className="focus-actions"><button className="btn pri" onClick={()=>setAlert(null)}>Done</button><button className="btn" onClick={()=>snooze(5)}>Snooze 5m</button><button className="btn" onClick={()=>snooze(10)}>Snooze 10m</button><button className="btn" onClick={()=>snooze(30)}>30m</button></div></div></div>}
  </>;
}
