// 오늘운동 v2 — progression, rest days, custom exercises, per-week increments, timer vibration

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

// Storage keys
const K_SETTINGS = "workout.v2.settings";
const K_DAILY = (ds) => `workout.v2.daily.${ds}`;

// Defaults
const defaultSettings = {
  startDate: null,                // 'YYYY-MM-DD'
  restDays: [false,false,false,false,false,false,false], // Sun..Sat
  exercises: [
    { key:"pushups", name:"팔굽 (Push-ups)", type:"reps", base:8, incPerWeek:4, sets:3 },
    { key:"plank",   name:"플랭크 (Plank)", type:"timer", base:20, incPerWeek:15, sets:3 },
    { key:"squats",  name:"스쿼트 (Squats)", type:"reps", base:10, incPerWeek:4, sets:3 },
  ]
};

function todayStr(){
  const d = new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function fmtDateK(dstr) {
  const d = new Date(dstr + "T00:00:00");
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function diffDays(a,b){
  const da = new Date(a+"T00:00:00"); const db = new Date(b+"T00:00:00");
  return Math.round((db-da)/(1000*60*60*24));
}
function weekIndex(startDate, today){ return Math.floor(Math.max(0, diffDays(startDate, today))/7); }
function dayNumber(startDate, today){ return diffDays(startDate, today)+1; }
function isRestDay(restDays, date){
  const d = new Date(date+"T00:00:00"); return !!restDays[d.getDay()];
}
function playBeep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime+0.01);
    o.start(); o.stop(ctx.currentTime+0.15);
  }catch{}
}
function vibrateOkay(){ if (navigator.vibrate) { navigator.vibrate(200); return true; } return false; }

function loadSettings(){
  try{ const s = JSON.parse(localStorage.getItem(K_SETTINGS)); return s ?? structuredClone(defaultSettings); }
  catch{ return structuredClone(defaultSettings); }
}
function saveSettings(s){ localStorage.setItem(K_SETTINGS, JSON.stringify(s)); }
function loadDaily(ds){ try{ return JSON.parse(localStorage.getItem(K_DAILY(ds))) ?? {}; }catch{ return {}; } }
function saveDaily(ds, data){ localStorage.setItem(K_DAILY(ds), JSON.stringify(data)); }

let settings = loadSettings();
let dateStr = todayStr();
let daily = loadDaily(dateStr);

function ensureDailyStructure(){
  if (!daily.ex) daily.ex = {};
  for (const ex of settings.exercises){
    const key = ex.key;
    if (!daily.ex[key]) daily.ex[key] = { done: Array(ex.sets).fill(false) };
    const arr = daily.ex[key].done;
    if (arr.length < ex.sets){ while(arr.length<ex.sets) arr.push(false); }
    else if (arr.length > ex.sets){ daily.ex[key].done = arr.slice(0, ex.sets); }
  }
  saveDaily(dateStr, daily);
}

function targetFor(ex, wIdx){ return Math.max(1, (ex.base|0) + (ex.incPerWeek|0)*wIdx); }

// UI refs
const dateLabel = $("#date");
const dayBadge = $("#dayBadge");
const restBanner = $("#restBanner");
const planList = $("#planList");
const exList = $("#exerciseList");
const summary = $("#summary");
const clearBtn = $("#clearToday");
const installBtn = $("#installBtn");
const onboard = $("#onboard"); const onDay=$("#onDay"); const onStartDate=$("#onStartDate"); const onConfirm=$("#onConfirm");
const cfgStartDate=$("#cfgStartDate"); const restDaysUI=$("#restDays"); const defaultIncs=$("#defaultIncs"); const exCfgs=$("#exerciseConfigs"); const saveCfg=$("#saveCfg");
const addExerciseBtn=$("#addExerciseBtn");

function renderDate(){
  dateLabel.textContent = fmtDateK(dateStr);
  if (settings.startDate){ dayBadge.textContent = `${dayNumber(settings.startDate, dateStr)}일차`; } else dayBadge.textContent = "";
}
function renderRestBanner(){ if (settings.startDate && isRestDay(settings.restDays, dateStr)) restBanner.classList.remove('hidden'); else restBanner.classList.add('hidden'); }
function renderPlan(){
  planList.innerHTML="";
  if (!settings.startDate) return;
  const wIdx = weekIndex(settings.startDate, dateStr);
  const isRest = isRestDay(settings.restDays, dateStr);
  for(const ex of settings.exercises){
    const target = targetFor(ex, wIdx);
    const doneCount = daily.ex?.[ex.key]?.done?.filter(Boolean).length ?? 0;
    const pillTarget = ex.type==="timer" ? `${target}초` : `${target}회`;
    const el = document.createElement("div");
    el.className="plan-item";
    el.innerHTML = `<div class="title"><span>${ex.name}</span></div>
      <div><span class="pill">${ex.sets} x ${pillTarget}</span> <span class="pill">${doneCount}/${ex.sets}</span></div>`;
    if (isRest) el.classList.add("muted");
    planList.appendChild(el);
  }
}

function setDone(key, idx, val){
  daily.ex[key].done[idx] = !!val; saveDaily(dateStr, daily);
  renderPlan(); renderExercises(); renderSummary();
}

function buildExerciseRow(ex){
  const tpl = $("#exerciseTpl").content.firstElementChild.cloneNode(true);
  const root = tpl;
  $(".ex-name", root).textContent = ex.name;
  $(".sets-count", root).textContent = ex.sets;
  const repsDiv = $(".reps", root);
  const wIdx = settings.startDate ? weekIndex(settings.startDate, dateStr) : 0;
  const target = targetFor(ex, wIdx);
  repsDiv.innerHTML = (ex.type==="timer") ? `한 세트: <b>${target}</b> 초` : `한 세트: <b>${target}</b> 회`;

  const setsWrap = $(".sets", root);
  const arr = daily.ex[ex.key].done;
  setsWrap.innerHTML = "";
  arr.forEach((isDone, idx)=>{
    const div = document.createElement("div");
    div.className = "set" + (isDone? " done": "");
    div.innerHTML = `<span class="badge">${idx+1}</span><span class="label">${ex.type==="timer"? `${target}초`:`${target}회`}</span>`;
    let timer;
    div.addEventListener('touchstart', ()=>{ timer=setTimeout(()=>{ setDone(ex.key, idx, false); }, 450); }, {passive:true});
    div.addEventListener('touchend', ()=> clearTimeout(timer), {passive:true});
    div.addEventListener('click', ()=>{ if (!isRestDay(settings.restDays, dateStr)) setDone(ex.key, idx, !daily.ex[ex.key].done[idx]); });
    setsWrap.appendChild(div);
  });

  // plus/minus sets
  const minus = $(".minus", root); const plus = $(".plus", root);
  minus.addEventListener('click', ()=>{ ex.sets=Math.max(1,ex.sets-1); saveSettings(settings); ensureDailyStructure(); renderAll(); });
  plus.addEventListener('click', ()=>{ ex.sets=Math.min(20,ex.sets+1); saveSettings(settings); ensureDailyStructure(); renderAll(); });

  // timer controls
  const tRow = $(".timer-row", root);
  if (ex.type==="timer"){
    tRow.classList.remove("hidden");
    const tEl = $(".timer", tRow), btnS=$(".tStart", tRow), btnP=$(".tPause", tRow), btnR=$(".tReset", tRow);
    let interval=null, remaining=target;
    function draw(){ const m=Math.floor(remaining/60), s=remaining%60; tEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
    draw();
    function tick(){
      remaining = Math.max(0, remaining-1); draw();
      if (remaining===0){
        clearInterval(interval); interval=null; btnS.classList.remove('active'); btnP.disabled=true; btnR.disabled=false;
        if (!vibrateOkay()) { playBeep(); tEl.classList.add('flash'); setTimeout(()=>tEl.classList.remove('flash'), 450); }
        const idx = daily.ex[ex.key].done.findIndex(v=>!v);
        if (idx>=0) setDone(ex.key, idx, true);
      }
    }
    btnS.addEventListener('click', ()=>{ if(interval) return; btnS.classList.add('active'); btnP.disabled=false; btnR.disabled=false; if(remaining<=0) remaining=target; interval=setInterval(tick,1000); });
    btnP.addEventListener('click', ()=>{ if(!interval) return; clearInterval(interval); interval=null; btnS.classList.remove('active'); });
    btnR.addEventListener('click', ()=>{ if(interval){clearInterval(interval); interval=null;} remaining=target; draw(); btnP.disabled=true; btnR.disabled=true; btnS.classList.remove('active'); });
  }

  return root;
}

function renderExercises(){
  exList.innerHTML = "";
  if (!settings.startDate) return;
  for (const ex of settings.exercises){
    exList.appendChild(buildExerciseRow(ex));
  }
}

function renderSummary(){
  if (!settings.startDate){ summary.textContent=""; return; }
  if (isRestDay(settings.restDays, dateStr)){ summary.textContent="휴식일 — 기록 없음"; return; }
  const parts = settings.exercises.map(ex=>{
    const d = (daily.ex?.[ex.key]?.done||[]).filter(Boolean).length;
    return `${ex.name.split(' ')[0]}: ${d}/${ex.sets}`;
  });
  summary.textContent = parts.join(" • ");
}

function renderSettings(){
  cfgStartDate.value = settings.startDate || "";
  // rest days
  const names=["일","월","화","수","목","금","토"];
  restDaysUI.innerHTML="";
  names.forEach((n,i)=>{
    const lab=document.createElement('label'); lab.innerHTML=`<input type="checkbox"> ${n}`;
    const cb = lab.querySelector('input'); cb.checked=!!settings.restDays[i];
    cb.addEventListener('change', ()=>{ settings.restDays[i]=cb.checked; saveSettings(settings); renderAll(); });
    restDaysUI.appendChild(lab);
  });
  // default increments for the classic trio if present
  defaultIncs.innerHTML="";
  const map = Object.fromEntries(settings.exercises.map(ex=>[ex.key,ex]));
  function addInc(key,label){
    const ex = map[key]; if(!ex) return;
    const wrap=document.createElement('div');
    wrap.innerHTML = `<div class="pill">${label}</div><label>주간증가 <input type="number" min="0" value="${ex.incPerWeek}" data-key="${key}" class="inc-input"></label>`;
    defaultIncs.appendChild(wrap);
  }
  addInc("pushups","팔굽"); addInc("plank","플랭크"); addInc("squats","스쿼트");
  defaultIncs.addEventListener('change', (e)=>{
    const t=e.target; if(!t.classList.contains('inc-input'))return;
    const k=t.dataset.key; const ex=settings.exercises.find(x=>x.key===k); if(ex){ ex.incPerWeek=Math.max(0,Math.floor(+t.value||0)); saveSettings(settings); renderAll(); }
  });
  // per-exercise configs
  exCfgs.innerHTML="";
  for(const ex of settings.exercises){
    const row = $("#exCfgTpl").content.firstElementChild.cloneNode(true);
    $(".cfg-name", row).textContent = ex.name;
    $(".cfg-type", row).textContent = ex.type==="timer"?"타이머":"반복";
    const iSets=$(".cfg-sets", row), iBase=$(".cfg-base", row), iInc=$(".cfg-inc", row);
    iSets.value=ex.sets; iBase.value=ex.base; iInc.value=ex.incPerWeek;
    iSets.addEventListener('change', ()=>{ ex.sets=Math.max(1,Math.floor(+iSets.value||1)); saveSettings(settings); ensureDailyStructure(); renderAll(); });
    iBase.addEventListener('change', ()=>{ ex.base=Math.max(1,Math.floor(+iBase.value||1)); saveSettings(settings); renderAll(); });
    iInc.addEventListener('change', ()=>{ ex.incPerWeek=Math.max(0,Math.floor(+iInc.value||0)); saveSettings(settings); renderAll(); });
    exCfgs.appendChild(row);
  }
}

function renderAll(){ renderDate(); renderRestBanner(); ensureDailyStructure(); renderPlan(); renderExercises(); renderSummary(); renderSettings(); }

function maybeOnboard(){
  if (settings.startDate){ onboard.classList.add('hidden'); return; }
  onboard.classList.remove('hidden'); onStartDate.value = todayStr();
}
onConfirm.addEventListener('click', ()=>{
  const n = Math.max(1, Math.floor(+onDay.value||1));
  const pick = onStartDate.value;
  let start;
  if (pick) start = pick;
  else {
    const d = new Date(); d.setDate(d.getDate() - (n-1));
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    start = `${y}-${m}-${day}`;
  }
  settings.startDate = start; saveSettings(settings);
  daily = loadDaily(dateStr); ensureDailyStructure(); onboard.classList.add('hidden'); renderAll();
});

saveCfg.addEventListener('click', ()=>{
  settings.startDate = cfgStartDate.value || settings.startDate; saveSettings(settings);
  renderAll(); alert("저장되었습니다.");
});

addExerciseBtn.addEventListener('click', ()=>{
  const name = prompt("운동 이름을 입력하세요 (예: 버피)"); if(!name) return;
  const type = (prompt("타입: reps(회) 또는 timer(초)", "reps")||"reps").toLowerCase().startsWith('t') ? "timer":"reps";
  const base = Math.max(1, Math.floor(+prompt("기본값(회/초)", type==="timer"?"30":"10")||10));
  const inc = Math.max(0, Math.floor(+prompt("주간 증가량(회/초)", type==="timer"?"5":"2")||0));
  const sets = Math.max(1, Math.floor(+prompt("세트 수", "3")||3));
  const key = name.toLowerCase().replace(/\s+/g,'_') + "_" + Math.random().toString(36).slice(2,6);
  settings.exercises.push({ key, name, type, base, incPerWeek:inc, sets });
  saveSettings(settings); ensureDailyStructure(); renderAll();
});

clearBtn.addEventListener('click', ()=>{
  if (confirm("오늘 기록을 초기화할까요?")){
    localStorage.removeItem(K_DAILY(dateStr)); daily = loadDaily(dateStr); ensureDailyStructure(); renderAll();
  }
});

setInterval(()=>{ const now=todayStr(); if (now!==dateStr){ dateStr=now; daily=loadDaily(dateStr); ensureDailyStructure(); renderAll(); } }, 30_000);

let deferredPrompt; window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; installBtn.hidden=false; });
installBtn.addEventListener('click', async ()=>{
  if (deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true; }
  else alert("iOS는 Safari 공유 버튼 → '홈 화면에 추가'");
});

if ('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js')); }

function init(){ ensureDailyStructure(); renderAll(); maybeOnboard(); }
init();
