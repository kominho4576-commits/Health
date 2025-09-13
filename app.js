// 오늘운동 v3.0 — Tabs + Calendar + Rank + Weekday routines

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const K_SETTINGS = "workout.v3.settings";
const K_DAILY = (ds) => `workout.v3.daily.${ds}`;
const K_META = "workout.v3.meta"; // for rank points etc

const defaultSettings = {
  startDate: null,
  restDays: [false,false,false,false,false,false,false], // Sun..Sat
  exercises: [
    { key:"pushups", name:"팔굽 (Push-ups)", type:"reps", base:8, incPerWeek:4, sets:3, weekdays:[true,true,true,true,true,false,false] },
    { key:"plank",   name:"플랭크 (Plank)", type:"timer", base:20, incPerWeek:15, sets:3, weekdays:[true,true,true,true,true,false,false] },
    { key:"squats",  name:"스쿼트 (Squats)", type:"reps", base:10, incPerWeek:4, sets:3, weekdays:[true,true,true,true,true,false,false] },
  ]
};

// audio unlock
let __audioCtx = null, __audioUnlocked = false;
function __unlockAudio(){
  if (__audioUnlocked) return;
  try {
    __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = __audioCtx.createBuffer(1, 1, 22050);
    const source = __audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(__audioCtx.destination);
    source.start(0);
    __audioUnlocked = true;
  } catch {}
}
window.addEventListener('touchstart', __unlockAudio, { once: true, passive: true });
window.addEventListener('click', __unlockAudio, { once: true });

function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDateK(s){ const d=new Date(s+"T00:00:00"); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; }
function diffDays(a,b){ const da=new Date(a+"T00:00:00"), db=new Date(b+"T00:00:00"); return Math.round((db-da)/(1000*60*60*24)); }
function weekIndex(start,today){ return Math.floor(Math.max(0,diffDays(start,today))/7); }
function dayNumber(start,today){ return diffDays(start,today)+1; }
function isRestDay(rest,date){ const d=new Date(date+"T00:00:00"); return !!rest[d.getDay()]; }
function playBeep(){ try{ const c=__audioCtx || new (window.AudioContext||window.webkitAudioContext)(); const o=c.createOscillator(), g=c.createGain(); o.type="triangle"; o.frequency.value=880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.001,c.currentTime); g.gain.exponentialRampToValueAtTime(0.3,c.currentTime+0.01); o.start(); o.stop(c.currentTime+0.15);}catch{} }
function vibrateOkay(){ if(navigator.vibrate){navigator.vibrate(200); return true;} return false; }

function loadSettings(){ try{ return JSON.parse(localStorage.getItem(K_SETTINGS)) ?? structuredClone(defaultSettings);}catch{ return structuredClone(defaultSettings);} }
function saveSettings(s){ localStorage.setItem(K_SETTINGS, JSON.stringify(s)); }
function loadDaily(ds){ try{ return JSON.parse(localStorage.getItem(K_DAILY(ds))) ?? {}; }catch{ return {}; } }
function saveDaily(ds,data){ localStorage.setItem(K_DAILY(ds), JSON.stringify(data)); }
function loadMeta(){ try{ return JSON.parse(localStorage.getItem(K_META)) ?? { points:0, lastActive:null, streak:0 }; }catch{ return { points:0, lastActive:null, streak:0 }; } }
function saveMeta(m){ localStorage.setItem(K_META, JSON.stringify(m)); }

let settings = loadSettings();
let meta = loadMeta();
let dateStr = todayStr();
let daily = loadDaily(dateStr);

function ensureDailyStructure(){
  if (!daily.ex) daily.ex = {};
  for (const ex of settings.exercises){
    const k=ex.key;
    if (!daily.ex[k]) daily.ex[k] = { done: Array(ex.sets).fill(false) };
    const arr = daily.ex[k].done;
    if (arr.length<ex.sets){ while(arr.length<ex.sets) arr.push(false); }
    else if (arr.length>ex.sets){ daily.ex[k].done = arr.slice(0,ex.sets); }
  }
  for (const k of Object.keys(daily.ex)){ if (!settings.exercises.find(e=>e.key===k)) delete daily.ex[k]; }
  saveDaily(dateStr, daily);
}

function targetFor(ex, w){ return Math.max(1, (ex.base|0) + (ex.incPerWeek|0)*w); }
function isExerciseScheduledToday(ex, date){
  const d = new Date(date+"T00:00:00");
  const dow = d.getDay(); // 0 Sun..6 Sat
  if (!Array.isArray(ex.weekdays) || ex.weekdays.length!==7){ ex.weekdays=[true,true,true,true,true,false,false]; saveSettings(settings); }
  const map = [6,0,1,2,3,4,5]; // Sun..Sat -> idx Mon..Sun
  const idx = map[dow];
  return !!ex.weekdays[idx];
}

// ranks
const RANKS = [
  { name:"Bronze", req:0 },
  { name:"Silver", req:300 },
  { name:"Gold", req:800 },
  { name:"Platinum", req:1600 },
  { name:"Diamond", req:2800 },
  { name:"Master", req:4500 },
  { name:"GrandMaster", req:7000 }
];
function gainPointsForCompletion(ex){ return 10; }
function updateDailyPoints(){
  const ds = dateStr;
  let pts = 0;
  for (const ex of settings.exercises){
    const arr = daily.ex?.[ex.key]?.done || [];
    const c = arr.filter(Boolean).length;
    pts += c * gainPointsForCompletion(ex);
  }
  const hadAny = pts>0;
  if (meta.lastActive !== ds && hadAny){
    const y = new Date(ds+"T00:00:00"); y.setDate(y.getDate()-1);
    const ys = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    const yd = loadDaily(ys);
    let yAny = false;
    for (const k in (yd.ex||{})){ if ((yd.ex[k].done||[]).some(Boolean)) { yAny=true; break; } }
    meta.streak = yAny ? (meta.streak||0)+1 : 1;
    meta.lastActive = ds;
    saveMeta(meta);
  }
  daily.points = pts; saveDaily(ds, daily);
  let total = 0;
  for (let i=0; i<localStorage.length; i++){
    const k = localStorage.key(i);
    if (k && k.startsWith('workout.v3.daily.')){
      try{ const d = JSON.parse(localStorage.getItem(k)) || {}; total += d.points||0; }catch{}
    }
  }
  meta.points = total + Math.max(0,(meta.streak-1))*5;
  saveMeta(meta);
}
function rankInfoFromPoints(p){
  let cur = RANKS[0], next = null;
  for (let i=0;i<RANKS.length;i++){ if (p >= RANKS[i].req){ cur = RANKS[i]; next = RANKS[i+1]||null; } }
  const into = p - cur.req; const range = next? (next.req - cur.req):1;
  const prog = Math.max(0, Math.min(100, Math.floor(into*100/range)));
  return {cur,next,prog};
}

// views & tabbar
const views = {
  home: document.getElementById("view-home"),
  calendar: document.getElementById("view-calendar"),
  rank: document.getElementById("view-rank"),
  settings: document.getElementById("view-settings"),
};
const tabbar = document.querySelector(".tabbar");
tabbar.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-view]'); if(!btn) return;
  const v = btn.dataset.view;
  document.querySelectorAll(".tabbar button").forEach(b=>b.classList.toggle('active', b===btn));
  Object.entries(views).forEach(([k,el])=>{ el.classList.toggle('active', k===v); });
  document.getElementById("title").textContent = v==="home"?"오늘운동": v==="calendar"?"달력": v==="rank"?"랭크":"설정";
  if (v==="calendar") renderCalendar();
  if (v==="rank") renderRank();
});

// home refs
const dateLabel=document.getElementById("date"), dayBadge=document.getElementById("dayBadge"), restBanner=document.getElementById("restBanner"), planList=document.getElementById("planList"), exList=document.getElementById("exerciseList"), summary=document.getElementById("summary");
const clearBtn=document.getElementById("clearToday"), installBtn=document.getElementById("installBtn");
const onboard=document.getElementById("onboard"), onDay=document.getElementById("onDay"), onStartDate=document.getElementById("onStartDate"), onConfirm=document.getElementById("onConfirm");

// settings refs
const cfgStartDate=document.getElementById("cfgStartDate"), restDaysUI=document.getElementById("restDays"), defaultIncs=document.getElementById("defaultIncs"), exCfgs=document.getElementById("exerciseConfigs"), saveCfg=document.getElementById("saveCfg");
const addExerciseBtn=document.getElementById("addExerciseBtn");

// calendar refs
const calPrev=document.getElementById("calPrev"); const calNext=document.getElementById("calNext"); const calMonth=document.getElementById("calMonth"); const calEl=document.getElementById("calendar"); const calDetail=document.getElementById("calDetail");
let calCtx = (function(){ const d=new Date(); return { year:d.getFullYear(), month:d.getMonth() }; })();

// rank refs
const rankBadge=document.getElementById("rankBadge"), rankBar=document.getElementById("rankBar"), rankInfo=document.getElementById("rankInfo"), questList=document.getElementById("questList");

function renderDate(){ dateLabel.textContent=fmtDateK(dateStr); if (settings.startDate){ dayBadge.textContent=`${dayNumber(settings.startDate, dateStr)}일차`; } else dayBadge.textContent=""; }
function renderRestBanner(){ if (settings.startDate && isRestDay(settings.restDays, dateStr)) restBanner.classList.remove('hidden'); else restBanner.classList.add('hidden'); }

function renderPlan(){
  planList.innerHTML = "";
  if (!settings.startDate) return;
  const wIdx = weekIndex(settings.startDate, dateStr);
  const isRest = isRestDay(settings.restDays, dateStr);
  for (const ex of settings.exercises){
    if (!isExerciseScheduledToday(ex, dateStr)) continue;
    const target = targetFor(ex, wIdx);
    const doneCount = daily.ex?.[ex.key]?.done?.filter(Boolean).length ?? 0;
    const pillTarget = ex.type==="timer" ? `${target}초` : `${target}회`;
    const el = document.createElement("div");
    el.className = "plan-item";
    el.innerHTML = `<div class="title"><span>${ex.name}</span></div>
      <div><span class="pill">${ex.sets} x ${pillTarget}</span> <span class="pill">${doneCount}/${ex.sets}</span></div>`;
    if (isRest) el.classList.add("muted");
    planList.appendChild(el);
  }
}

function setDone(key, idx, val){
  daily.ex[key].done[idx] = !!val;
  saveDaily(dateStr, daily);
  updateDailyPoints();
  renderPlan(); renderExercises(); renderSummary(); renderRank();
}

function buildExerciseRow(ex){
  if (!isExerciseScheduledToday(ex, dateStr)) return null;
  const root = document.getElementById("exerciseTpl").content.firstElementChild.cloneNode(true);
  root.querySelector(".ex-name").textContent = ex.name;
  root.querySelector(".sets-count").textContent = ex.sets;

  const repsDiv = root.querySelector(".reps");
  const wIdx = settings.startDate ? weekIndex(settings.startDate, dateStr) : 0;
  const target = targetFor(ex, wIdx);
  repsDiv.innerHTML = (ex.type==="timer") ? `한 세트: <b>${target}</b> 초` : `한 세트: <b>${target}</b> 회`;

  const setsWrap = root.querySelector(".sets");
  const arr = daily.ex[ex.key].done;
  setsWrap.innerHTML = "";
  arr.forEach((isDone, idx)=>{
    const div = document.createElement("div");
    div.className = "set" + (isDone? " done": "");
    div.innerHTML = `<span class="badge">${idx+1}</span><span class="label">${ex.type==="timer"? `${target}초`:`${target}회`}</span>`;
    let timer;
    div.addEventListener('touchstart', ()=>{ timer=setTimeout(()=>{ setDone(ex.key, idx, false); }, 450); }, {passive:true});
    div.addEventListener('touchend', ()=> clearTimeout(timer), {passive:true});
    div.addEventListener('click', ()=>{
      if (isRestDay(settings.restDays, dateStr)) return;
      setDone(ex.key, idx, !daily.ex[ex.key].done[idx]);
    });
    setsWrap.appendChild(div);
  });

  const minus = root.querySelector(".minus");
  const plus = root.querySelector(".plus");
  minus.addEventListener('click', ()=>{ ex.sets=Math.max(1,ex.sets-1); saveSettings(settings); ensureDailyStructure(); renderAll(); });
  plus.addEventListener('click', ()=>{ ex.sets=Math.min(20,ex.sets+1); saveSettings(settings); ensureDailyStructure(); renderAll(); });

  const tRow = root.querySelector(".timer-row");
  if (ex.type==="timer"){
    tRow.classList.remove("hidden");
    const tEl = tRow.querySelector(".timer");
    const btnS = tRow.querySelector(".tStart");
    const btnP = tRow.querySelector(".tPause");
    const btnR = tRow.querySelector(".tReset");
    let interval=null, remaining = target;
    const draw = ()=>{ const m=Math.floor(remaining/60), s=remaining%60; tEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
    draw();
    const tick = ()=>{
      remaining = Math.max(0, remaining-1); draw();
      if (remaining===0){
        clearInterval(interval); interval=null; btnS.classList.remove('active'); btnP.disabled=true; btnR.disabled=false;
        if (!vibrateOkay()) { playBeep(); tEl.classList.add('flash'); setTimeout(()=>tEl.classList.remove('flash'), 450); }
        const idx = daily.ex[ex.key].done.findIndex(v=>!v);
        if (idx>=0){ setDone(ex.key, idx, true); }
      }
    };
    btnS.addEventListener('click', ()=>{ if(interval) return; btnS.classList.add('active'); btnP.disabled=false; btnR.disabled=false; if (remaining<=0) remaining=target; interval=setInterval(tick, 1000); });
    btnP.addEventListener('click', ()=>{ if(!interval) return; clearInterval(interval); interval=null; btnS.classList.remove('active'); });
    btnR.addEventListener('click', ()=>{ if(interval){clearInterval(interval); interval=null;} remaining=target; draw(); btnP.disabled=true; btnR.disabled=true; btnS.classList.remove('active'); });
  }

  return root;
}

function renderExercises(){
  exerciseList.innerHTML = "";
  if (!settings.startDate) return;
  for (const ex of settings.exercises){
    const row = buildExerciseRow(ex);
    if (row) exerciseList.appendChild(row);
  }
}

function renderSummary(){
  if (!settings.startDate){ summary.textContent=""; return; }
  const rest = isRestDay(settings.restDays, dateStr);
  if (rest){ summary.textContent="휴식일 — 기록 없음"; return; }
  const parts = settings.exercises.filter(ex=>isExerciseScheduledToday(ex,dateStr)).map(ex=>{
    const d = (daily.ex?.[ex.key]?.done||[]).filter(Boolean).length;
    return `${ex.name.split(' ')[0]}: ${d}/${ex.sets}`;
  });
  summary.textContent = parts.join(" • ") || "오늘은 루틴에 지정된 운동이 없습니다";
}

// Settings
function renderSettings(){
  cfgStartDate.value = settings.startDate || "";
  const names=["일","월","화","수","목","금","토"];
  restDaysUI.innerHTML = "";
  names.forEach((n,i)=>{
    const lab=document.createElement('label'); lab.innerHTML=`<input type="checkbox"> ${n}`;
    const cb=lab.querySelector('input'); cb.checked=!!settings.restDays[i];
    cb.addEventListener('change', ()=>{ settings.restDays[i]=cb.checked; saveSettings(settings); renderAll(); });
    restDaysUI.appendChild(lab);
  });

  defaultIncs.innerHTML = "";
  const map = Object.fromEntries(settings.exercises.map(ex=>[ex.key, ex]));
  const addInc = (key, label)=>{
    const ex = map[key]; if(!ex) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="pill">${label}</div><label>주간증가 <input type="number" min="0" value="${ex.incPerWeek}" data-key="${key}" class="inc-input"></label>`;
    defaultIncs.appendChild(wrap);
  };
  addInc("pushups","팔굽"); addInc("plank","플랭크"); addInc("squats","스쿼트");
  defaultIncs.addEventListener('change', (e)=>{
    const t=e.target; if(!t.classList.contains('inc-input')) return;
    const ex=settings.exercises.find(x=>x.key===t.dataset.key);
    if (ex){ ex.incPerWeek=Math.max(0,Math.floor(+t.value||0)); saveSettings(settings); renderAll(); }
  });

  exCfgs.innerHTML = "";
  for (const ex of settings.exercises){
    const row = document.getElementById("exCfgTpl").content.firstElementChild.cloneNode(true);
    row.querySelector(".cfg-name").textContent = ex.name;
    row.querySelector(".cfg-type").textContent = ex.type==="timer"?"타이머":"반복";
    const iSets = row.querySelector(".cfg-sets"), iBase=row.querySelector(".cfg-base"), iInc=row.querySelector(".cfg-inc");
    iSets.value = ex.sets; iBase.value = ex.base; iInc.value = ex.incPerWeek;
    iSets.addEventListener('change', ()=>{ ex.sets=Math.max(1,Math.floor(+iSets.value||1)); saveSettings(settings); ensureDailyStructure(); renderAll(); });
    iBase.addEventListener('change', ()=>{ ex.base=Math.max(1,Math.floor(+iBase.value||1)); saveSettings(settings); renderAll(); });
    iInc.addEventListener('change', ()=>{ ex.incPerWeek=Math.max(0,Math.floor(+iInc.value||0)); saveSettings(settings); renderAll(); });
    const del = row.querySelector('.cfg-del');
    del.addEventListener('click', ()=>{
      if (!confirm(`'${ex.name}' 운동을 삭제할까요?`)) return;
      const idx = settings.exercises.findIndex(e=>e.key===ex.key);
      if (idx>=0) settings.exercises.splice(idx,1);
      saveSettings(settings);
      if (daily.ex && daily.ex[ex.key]) { delete daily.ex[ex.key]; saveDaily(dateStr, daily); }
      ensureDailyStructure(); renderAll();
    });
    const cbs = row.querySelectorAll('.dow-cb');
    if (!Array.isArray(ex.weekdays) || ex.weekdays.length!==7){ ex.weekdays=[true,true,true,true,true,false,false]; }
    cbs.forEach(cb=>{
      const dow = +cb.dataset.dow; // 0 Sun..6 Sat
      const map = {1:0,2:1,3:2,4:3,5:4,6:5,0:6}; // -> idx Mon..Sun
      const idx = map[dow];
      cb.checked = !!ex.weekdays[idx];
      cb.addEventListener('change', ()=>{ ex.weekdays[idx]=cb.checked; saveSettings(settings); renderAll(); });
    });
    exCfgs.appendChild(row);
  }
}

function renderAll(){ renderDate(); renderRestBanner(); ensureDailyStructure(); renderPlan(); renderExercises(); renderSummary(); renderSettings(); updateDailyPoints(); }

// onboarding
function maybeOnboard(){
  if (settings.startDate) { onboard.classList.add('hidden'); return; }
  onboard.classList.remove('hidden'); onStartDate.value = todayStr();
}
onConfirm.addEventListener('click', ()=>{
  const n = Math.max(1, Math.floor(+onDay.value||1));
  const pick = onStartDate.value;
  let start;
  if (pick) start = pick;
  else { const d = new Date(); d.setDate(d.getDate() - (n-1)); start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  settings.startDate = start; saveSettings(settings);
  daily = loadDaily(dateStr); ensureDailyStructure(); onboard.classList.add('hidden'); renderAll();
});

saveCfg.addEventListener('click', ()=>{
  settings.startDate = cfgStartDate.value || settings.startDate;
  saveSettings(settings); renderAll(); alert("저장되었습니다.");
});

addExerciseBtn.addEventListener('click', ()=>{
  const name = prompt("운동 이름을 입력하세요 (예: 버피)"); if(!name) return;
  const type = (prompt("타입: reps(회) 또는 timer(초)", "reps")||"reps").toLowerCase().startsWith('t') ? "timer":"reps";
  const base = Math.max(1, Math.floor(+prompt("기본값(회/초)", type==="timer"?"30":"10")||10));
  const inc = Math.max(0, Math.floor(+prompt("주간 증가량(회/초)", type==="timer"?"5":"2")||0));
  const sets = Math.max(1, Math.floor(+prompt("세트 수", "3")||3));
  const weekdays = [true,true,true,true,true,false,false];
  const key = name.toLowerCase().replace(/\s+/g,'_') + "_" + Math.random().toString(36).slice(2,6);
  settings.exercises.push({ key, name, type, base, incPerWeek:inc, sets, weekdays });
  saveSettings(settings); ensureDailyStructure(); renderAll();
});

clearBtn.addEventListener('click', ()=>{
  if (confirm("오늘 기록을 초기화할까요?")){
    localStorage.removeItem(K_DAILY(dateStr));
    daily = loadDaily(dateStr);
    ensureDailyStructure(); renderAll();
  }
});

setInterval(()=>{
  const now = todayStr();
  if (now!==dateStr){
    dateStr = now; daily = loadDaily(dateStr); ensureDailyStructure(); renderAll();
  }
}, 30000);

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; installBtn.hidden=false; });
installBtn.addEventListener('click', async ()=>{
  if (deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true; }
  else alert("iOS는 Safari 공유 버튼 → '홈 화면에 추가'");
});

if ('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js')); }

/* Calendar */
function monthStr(y,m){ return `${y}.${String(m+1).padStart(2,'0')}`; }
function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
function renderCalendar(){
  const y=calCtx.year, m=calCtx.month;
  calMonth.textContent = monthStr(y,m);
  calEl.innerHTML = "";
  const head = document.createElement('div'); head.className='dow';
  ["일","월","화","수","목","금","토"].forEach(x=>{ const s=document.createElement('div'); s.textContent=x; head.appendChild(s); });
  calEl.appendChild(head);
  const firstDow = new Date(y, m, 1).getDay();
  const total = daysInMonth(y,m);
  for (let i=0;i<firstDow;i++){ const pad=document.createElement('div'); calEl.appendChild(pad); }
  for (let d=1; d<=total; d++){
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell=document.createElement('div'); cell.className='cell';
    const num=document.createElement('div'); num.className='d'; num.textContent=d; cell.appendChild(num);
    const dots=document.createElement('div'); dots.className='dots';
    const data = loadDaily(ds);
    let scheduledCount = 0, doneSets=0, totalSets=0;
    for (const ex of settings.exercises){
      if (!isExerciseScheduledToday(ex, ds)) continue;
      scheduledCount++;
      const arr = data.ex?.[ex.key]?.done || [];
      doneSets += arr.filter(Boolean).length;
      totalSets += arr.length||0;
    }
    const rest = isRestDay(settings.restDays, ds);
    if (rest){ const dot=document.createElement('div'); dot.className='dot rest'; dots.appendChild(dot); }
    else if (totalSets===0 && scheduledCount===0){ /* none */ }
    else {
      const dot=document.createElement('div');
      const complete = totalSets>0 && doneSets===totalSets;
      const partial = doneSets>0 && doneSets<totalSets;
      dot.className = 'dot ' + (complete?'done': partial?'partial':'');
      dots.appendChild(dot);
    }
    cell.appendChild(dots);
    cell.addEventListener('click', ()=>{
      let html = `<b>${fmtDateK(ds)}</b><br>`;
      if (rest) html += `휴식일`;
      else if (scheduledCount===0) html += `루틴 없음`;
      else {
        for (const ex of settings.exercises){
          if (!isExerciseScheduledToday(ex, ds)) continue;
          const arr = data.ex?.[ex.key]?.done || Array(ex.sets).fill(false);
          html += `${ex.name.split(' ')[0]}: ${arr.filter(Boolean).length}/${arr.length}<br>`;
        }
      }
      calDetail.innerHTML = html;
    });
    calEl.appendChild(cell);
  }
}
calPrev.addEventListener('click', ()=>{ calCtx.month--; if(calCtx.month<0){calCtx.month=11; calCtx.year--; } renderCalendar(); });
calNext.addEventListener('click', ()=>{ calCtx.month++; if(calCtx.month>11){calCtx.month=0; calCtx.year++; } renderCalendar(); });

/* Rank */
function renderRank(){
  const p = meta.points||0;
  const info = rankInfoFromPoints(p);
  rankBadge.textContent = info.cur.name;
  rankBar.style.width = info.prog + "%";
  rankInfo.textContent = info.next ? `다음 랭크(${info.next.name})까지 ${info.next.req - p}pt` : `최고 랭크 달성!`;
  const ds = dateStr;
  const wIdx = settings.startDate? weekIndex(settings.startDate, ds) : 0;
  const plank = settings.exercises.find(e=>e.type==="timer");
  const quests = [
    { id:'q_sets_6', label:'오늘 세트 6개 완료', done: totalSetsDoneToday()>=6, reward:30 },
    { id:'q_streak_3', label:'연속 3일 운동', done: (meta.streak||0)>=3, reward:50 },
    plank ? { id:'q_plank_time', label:`플랭크 ${Math.max(60, targetFor(plank,wIdx)*2)}초 이상`, done: (sumTimerDoneToday(plank.key)>=Math.max(60, targetFor(plank,wIdx)*2)), reward:25 } : null
  ].filter(Boolean);
  questList.innerHTML="";
  quests.forEach(q=>{
    const li=document.createElement('li');
    li.innerHTML = `<span>${q.label}</span><span class="${q.done?'pill':''}">${q.done?'완료 +'+q.reward+'pt':'미완료'}</span>`;
    questList.appendChild(li);
  });
}
function totalSetsDoneToday(){
  let c=0;
  for (const ex of settings.exercises){
    const arr = daily.ex?.[ex.key]?.done || [];
    c += arr.filter(Boolean).length;
  }
  return c;
}
function sumTimerDoneToday(key){
  const ds = dateStr;
  const wIdx = settings.startDate? weekIndex(settings.startDate, ds):0;
  const ex = settings.exercises.find(e=>e.key===key);
  if (!ex) return 0;
  const target = targetFor(ex, wIdx);
  const arr = daily.ex?.[key]?.done || [];
  return arr.filter(Boolean).length * target;
}

function init(){ ensureDailyStructure(); renderAll(); maybeOnboard(); renderCalendar(); renderRank(); }
if ('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js')); }
init();
