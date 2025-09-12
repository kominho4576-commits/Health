// 오늘운동 v2.1 — safe-area + delete exercise

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const K_SETTINGS = "workout.v2.settings";
const K_DAILY = (ds) => `workout.v2.daily.${ds}`;

const defaultSettings = {
  startDate: null,
  restDays: [false,false,false,false,false,false,false],
  exercises: [
    { key:"pushups", name:"팔굽 (Push-ups)", type:"reps", base:8, incPerWeek:4, sets:3 },
    { key:"plank",   name:"플랭크 (Plank)", type:"timer", base:20, incPerWeek:15, sets:3 },
    { key:"squats",  name:"스쿼트 (Squats)", type:"reps", base:10, incPerWeek:4, sets:3 },
  ]
};

function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDateK(s){ const d=new Date(s+"T00:00:00"); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; }
function diffDays(a,b){ const da=new Date(a+"T00:00:00"), db=new Date(b+"T00:00:00"); return Math.round((db-da)/(1000*60*60*24)); }
function weekIndex(start,today){ return Math.floor(Math.max(0,diffDays(start,today))/7); }
function dayNumber(start,today){ return diffDays(start,today)+1; }
function isRestDay(rest,date){ const d=new Date(date+"T00:00:00"); return !!rest[d.getDay()]; }
function playBeep(){ try{ const c=new (window.AudioContext||window.webkitAudioContext)(), o=c.createOscillator(), g=c.createGain(); o.type="triangle"; o.frequency.value=880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.001,c.currentTime); g.gain.exponentialRampToValueAtTime(0.3,c.currentTime+0.01); o.start(); o.stop(c.currentTime+0.15);}catch{} }
function vibrateOkay(){ if(navigator.vibrate){navigator.vibrate(200); return true;} return false; }

function loadSettings(){ try{ return JSON.parse(localStorage.getItem(K_SETTINGS)) ?? structuredClone(defaultSettings);}catch{ return structuredClone(defaultSettings);} }
function saveSettings(s){ localStorage.setItem(K_SETTINGS, JSON.stringify(s)); }
function loadDaily(ds){ try{ return JSON.parse(localStorage.getItem(K_DAILY(ds))) ?? {}; }catch{ return {}; } }
function saveDaily(ds,data){ localStorage.setItem(K_DAILY(ds), JSON.stringify(data)); }

let settings = loadSettings();
let dateStr = todayStr();
let daily = loadDaily(dateStr);

function ensureDailyStructure(){
  if (!daily.ex) daily.ex = {};
  for(const ex of settings.exercises){
    const k=ex.key;
    if (!daily.ex[k]) daily.ex[k] = { done: Array(ex.sets).fill(false) };
    const arr = daily.ex[k].done;
    if (arr.length<ex.sets){ while(arr.length<ex.sets) arr.push(false); }
    else if (arr.length>ex.sets){ daily.ex[k].done = arr.slice(0,ex.sets); }
  }
  // remove leftovers if exercises were deleted
  for (const k of Object.keys(daily.ex)){
    if (!settings.exercises.find(e=>e.key===k)) delete daily.ex[k];
  }
  saveDaily(dateStr, daily);
}

function targetFor(ex, w){ return Math.max(1, (ex.base|0) + (ex.incPerWeek|0)*w); }

const dateLabel=$("#date"), dayBadge=$("#dayBadge"), restBanner=$("#restBanner"), planList=$("#planList"), exList=$("#exerciseList"), summary=$("#summary");
const clearBtn=$("#clearToday"), installBtn=$("#installBtn");
const onboard=$("#onboard"), onDay=$("#onDay"), onStartDate=$("#onStartDate"), onConfirm=$("#onConfirm");
const cfgStartDate=$("#cfgStartDate"), restDaysUI=$("#restDays"), defaultIncs=$("#defaultIncs"), exCfgs=$("#exerciseConfigs"), saveCfg=$("#saveCfg");
const addExerciseBtn=$("#addExerciseBtn");

function renderDate(){ dateLabel.textContent=fmtDateK(dateStr); dayBadge.textContent = settings.startDate? `${dayNumber(settings.startDate, dateStr)}일차` : ""; }
function renderRestBanner(){ if (settings.startDate && isRestDay(settings.restDays, dateStr)) restBanner.classList.remove('hidden'); else restBanner.classList.add('hidden'); }
function renderPlan(){
  planList.innerHTML=""; if (!settings.startDate) return;
  const w=weekIndex(settings.startDate,dateStr); const rest=isRestDay(settings.restDays,dateStr);
  for(const ex of settings.exercises){
    const t=targetFor(ex,w), done=(daily.ex?.[ex.key]?.done||[]).filter(Boolean).length;
    const el=document.createElement('div'); el.className='plan-item';
    el.innerHTML=`<div class="title"><span>${ex.name}</span></div><div><span class="pill">${ex.sets} x ${ex.type==="timer"?`${t}초`:`${t}회`}</span> <span class="pill">${done}/${ex.sets}</span></div>`;
    if(rest) el.classList.add('muted'); planList.appendChild(el);
  }
}
function setDone(k,i,v){ daily.ex[k].done[i]=!!v; saveDaily(dateStr,daily); renderPlan(); renderExercises(); renderSummary(); }

function buildExerciseRow(ex){
  const row = $("#exerciseTpl").content.firstElementChild.cloneNode(true);
  $(".ex-name",row).textContent=ex.name; $(".sets-count",row).textContent=ex.sets;
  const w=settings.startDate?weekIndex(settings.startDate,dateStr):0; const t=targetFor(ex,w);
  $(".reps",row).innerHTML = ex.type==="timer"? `한 세트: <b>${t}</b> 초` : `한 세트: <b>${t}</b> 회`;
  const wrap=$(".sets",row); wrap.innerHTML="";
  daily.ex[ex.key].done.forEach((done,i)=>{
    const d=document.createElement('div'); d.className="set"+(done?" done":""); d.innerHTML=`<span class="badge">${i+1}</span><span class="label">${ex.type==="timer"?`${t}초`:`${t}회`}</span>`;
    let hold; d.addEventListener('touchstart',()=>{hold=setTimeout(()=>setDone(ex.key,i,false),450)},{passive:true}); d.addEventListener('touchend',()=>clearTimeout(hold),{passive:true});
    d.addEventListener('click',()=>{ if(!isRestDay(settings.restDays,dateStr)) setDone(ex.key,i,!daily.ex[ex.key].done[i]); });
    wrap.appendChild(d);
  });
  const minus=$(".minus",row), plus=$(".plus",row);
  minus.addEventListener('click',()=>{ ex.sets=Math.max(1,ex.sets-1); saveSettings(settings); ensureDailyStructure(); renderAll(); });
  plus.addEventListener('click',()=>{ ex.sets=Math.min(20,ex.sets+1); saveSettings(settings); ensureDailyStructure(); renderAll(); });
  if (ex.type==="timer"){
    const tRow=$(".timer-row",row); tRow.classList.remove('hidden');
    const tEl=$(".timer",tRow), bS=$(".tStart",tRow), bP=$(".tPause",tRow), bR=$(".tReset",tRow);
    let interval=null, remain=t; const draw=()=>{const m=Math.floor(remain/60), s=remain%60; tEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}; draw();
    const tick=()=>{ remain=Math.max(0,remain-1); draw(); if(remain===0){ clearInterval(interval); interval=null; bS.classList.remove('active'); bP.disabled=true; bR.disabled=false; if(!vibrateOkay()){ playBeep(); tEl.classList.add('flash'); setTimeout(()=>tEl.classList.remove('flash'),450);} const idx=daily.ex[ex.key].done.findIndex(v=>!v); if(idx>=0) setDone(ex.key,idx,true);} };
    bS.addEventListener('click',()=>{ if(interval) return; bS.classList.add('active'); bP.disabled=false; bR.disabled=false; if(remain<=0) remain=t; interval=setInterval(tick,1000); });
    bP.addEventListener('click',()=>{ if(!interval) return; clearInterval(interval); interval=null; bS.classList.remove('active'); });
    bR.addEventListener('click',()=>{ if(interval){clearInterval(interval); interval=null;} remain=t; draw(); bP.disabled=true; bR.disabled=true; bS.classList.remove('active'); });
  }
  return row;
}
function renderExercises(){ exList.innerHTML=""; if(!settings.startDate) return; for(const ex of settings.exercises){ exList.appendChild(buildExerciseRow(ex)); } }
function renderSummary(){
  if(!settings.startDate){ summary.textContent=""; return; }
  if(isRestDay(settings.restDays,dateStr)){ summary.textContent="휴식일 — 기록 없음"; return; }
  summary.textContent = settings.exercises.map(ex=>`${ex.name.split(' ')[0]}: ${(daily.ex?.[ex.key]?.done||[]).filter(Boolean).length}/${ex.sets}`).join(" • ");
}

function renderSettings(){
  cfgStartDate.value = settings.startDate || "";
  const names=["일","월","화","수","목","금","토"]; restDaysUI.innerHTML="";
  names.forEach((n,i)=>{ const lab=document.createElement('label'); lab.innerHTML=`<input type="checkbox"> ${n}`; const cb=lab.querySelector('input'); cb.checked=!!settings.restDays[i]; cb.addEventListener('change',()=>{ settings.restDays[i]=cb.checked; saveSettings(settings); renderAll(); }); restDaysUI.appendChild(lab); });
  defaultIncs.innerHTML=""; const map=Object.fromEntries(settings.exercises.map(ex=>[ex.key,ex]));
  const add=(k,l)=>{ const ex=map[k]; if(!ex) return; const wrap=document.createElement('div'); wrap.innerHTML=`<div class="pill">${l}</div><label>주간증가 <input type="number" min="0" value="${ex.incPerWeek}" data-key="${k}" class="inc-input"></label>`; defaultIncs.appendChild(wrap); };
  add("pushups","팔굽"); add("plank","플랭크"); add("squats","스쿼트");
  defaultIncs.addEventListener('change',(e)=>{ const t=e.target; if(!t.classList.contains('inc-input')) return; const ex=settings.exercises.find(x=>x.key===t.dataset.key); if(ex){ ex.incPerWeek=Math.max(0,Math.floor(+t.value||0)); saveSettings(settings); renderAll(); } });
  exCfgs.innerHTML="";
  for(const ex of settings.exercises){
    const row = $("#exCfgTpl").content.firstElementChild.cloneNode(true);
    $(".cfg-name",row).textContent=ex.name; $(".cfg-type",row).textContent=ex.type==="timer"?"타이머":"반복";
    const iSets=$(".cfg-sets",row), iBase=$(".cfg-base",row), iInc=$(".cfg-inc",row);
    iSets.value=ex.sets; iBase.value=ex.base; iInc.value=ex.incPerWeek;
    iSets.addEventListener('change',()=>{ ex.sets=Math.max(1,Math.floor(+iSets.value||1)); saveSettings(settings); ensureDailyStructure(); renderAll(); });
    iBase.addEventListener('change',()=>{ ex.base=Math.max(1,Math.floor(+iBase.value||1)); saveSettings(settings); renderAll(); });
    iInc.addEventListener('change',()=>{ ex.incPerWeek=Math.max(0,Math.floor(+iInc.value||0)); saveSettings(settings); renderAll(); });
    const del = row.querySelector('.cfg-del');
    del.addEventListener('click',()=>{
      if(!confirm(`'${ex.name}' 운동을 삭제할까요?`)) return;
      const idx=settings.exercises.findIndex(e=>e.key===ex.key);
      if(idx>=0) settings.exercises.splice(idx,1);
      saveSettings(settings);
      if(daily.ex && daily.ex[ex.key]){ delete daily.ex[ex.key]; saveDaily(dateStr,daily); }
      ensureDailyStructure(); renderAll();
    });
    exCfgs.appendChild(row);
  }
}

function renderAll(){ renderDate(); renderRestBanner(); ensureDailyStructure(); renderPlan(); renderExercises(); renderSummary(); renderSettings(); }
function maybeOnboard(){ if(settings.startDate){ onboard.classList.add('hidden'); return; } onboard.classList.remove('hidden'); onStartDate.value=todayStr(); }
onConfirm.addEventListener('click',()=>{
  const n=Math.max(1,Math.floor(+onDay.value||1)); const pick=onStartDate.value; let start;
  if(pick) start=pick; else{ const d=new Date(); d.setDate(d.getDate()-(n-1)); start=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  settings.startDate=start; saveSettings(settings); daily=loadDaily(dateStr); ensureDailyStructure(); onboard.classList.add('hidden'); renderAll();
});
saveCfg.addEventListener('click',()=>{ settings.startDate = cfgStartDate.value || settings.startDate; saveSettings(settings); renderAll(); alert("저장되었습니다."); });
addExerciseBtn.addEventListener('click',()=>{
  const name=prompt("운동 이름을 입력하세요 (예: 버피)"); if(!name) return;
  const type=(prompt("타입: reps(회) 또는 timer(초)", "reps")||"reps").toLowerCase().startsWith('t')?"timer":"reps";
  const base=Math.max(1,Math.floor(+prompt("기본값(회/초)", type==="timer"?"30":"10")||10));
  const inc=Math.max(0,Math.floor(+prompt("주간 증가량(회/초)", type==="timer"?"5":"2")||0));
  const sets=Math.max(1,Math.floor(+prompt("세트 수","3")||3));
  const key=name.toLowerCase().replace(/\s+/g,'_')+"_"+Math.random().toString(36).slice(2,6);
  settings.exercises.push({key,name,type,base,incPerWeek:inc,sets}); saveSettings(settings); ensureDailyStructure(); renderAll();
});
clearBtn.addEventListener('click',()=>{ if(confirm("오늘 기록을 초기화할까요?")){ localStorage.removeItem(K_DAILY(dateStr)); daily=loadDaily(dateStr); ensureDailyStructure(); renderAll(); } });
setInterval(()=>{ const now=todayStr(); if(now!==dateStr){ dateStr=now; daily=loadDaily(dateStr); ensureDailyStructure(); renderAll(); } },30000);
let deferredPrompt; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; installBtn.hidden=false;});
installBtn.addEventListener('click',async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true; } else alert("iOS는 Safari 공유 버튼 → '홈 화면에 추가'"); });
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js')); }
function init(){ ensureDailyStructure(); renderAll(); maybeOnboard(); } init();
