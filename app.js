// 오늘운동 v3.8.3 — dynamic layout + iOS-style
const $ = (s, el=document)=>el.querySelector(s);
const $$ = (s, el=document)=>[...el.querySelectorAll(s)];
const STORE_KEY = 'ow_state_v3_8_3';
const todayStr = new Date().toISOString().slice(0,10);

// ---------- Measure bars & avoid overlap ----------
function measureBars(){
  const nav = document.querySelector('.nav-large');
  const tab = document.querySelector('.tabbar');
  if(nav){ document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px'); }
  if(tab){ document.documentElement.style.setProperty('--tab-h', tab.offsetHeight + 'px'); }
}
window.addEventListener('load', measureBars);
window.addEventListener('resize', measureBars);
if (window.visualViewport) window.visualViewport.addEventListener('resize', measureBars);

// ---------- State ----------
function demoExercises(){
  return [
    {id: uid(), name:'푸쉬업', type:'count', sets:3, base:20, weeklyIncr:2, days:[1,3,5]},
    {id: uid(), name:'스쿼트', type:'count', sets:3, base:25, weeklyIncr:3, days:[1,3,5]},
    {id: uid(), name:'플랭크', type:'time',  sets:2, base:45, weeklyIncr:10, days:[2,4]}
  ];
}
function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw){
    const init = {
      startDate: todayStr,
      restDays: [],
      exercises: demoExercises(),
      logs: {},
      streak: 0,
      points: 0,
      rankPts: 0,
      lastQuestDate: null,
      questsByDate: {}
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(init));
    return init;
  }
  try{ return JSON.parse(raw);}catch(e){ console.error(e); return {}; }
}
function saveState(s){ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
let S = loadState();
$("#today-date").textContent = getKSTDateString(new Date());

// ---------- Utils ----------
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function uid(){ return Math.random().toString(36).slice(2,9); }
function daysBetween(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); }
function getKSTDateString(d){ const off=9*60; const local = new Date(d.getTime()+off*60000); return local.toISOString().slice(0,10); }
function formatHM(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }
function beepShort(){ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(), g=ctx.createGain(); o.type="square"; o.frequency.value=880; g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.2); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.2); }

// ---------- Bottom Tab Bar (true screen switching) ----------
$$(".tabbar-btn").forEach(btn=>{
  btn.addEventListener("click", ()=> switchTo(btn.dataset.tab));
});
function switchTo(tab){
  $$(".tabbar-btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const panel = $("#tab-"+tab);
  if(panel){ panel.classList.add("active"); }
  if(tab==='home') renderHome();
  if(tab==='calendar') renderCalendar();
  if(tab==='rank'){ renderRank(); renderQuests(); }
  if(tab==='settings') renderSettings();
}
window.addEventListener("DOMContentLoaded", ()=> switchTo("home"));

// ---------- Domain ----------
function isRestDay(dateStr){ const wd=new Date(dateStr).getDay(); return S.restDays.includes(wd); }
function exercisesForDate(dateStr){ const wd=new Date(dateStr).getDay(); return S.exercises.filter(ex=>ex.days.includes(wd)); }
function effectiveValue(ex, dateStr){ const weeks=Math.max(0, Math.floor(daysBetween(S.startDate, dateStr)/7)); return ex.base + weeks*(ex.weeklyIncr||0); }
function ensureLog(dateStr){
  if(!S.logs[dateStr]) S.logs[dateStr] = { setsDoneByExId:{}, secondsLeftByExId:{}, points:0, memo:'' };
  saveState(S); return S.logs[dateStr];
}
function addPoints(dateStr, delta){ const log=ensureLog(dateStr); log.points += delta; S.points += delta; S.rankPts += delta; saveState(S); }
function recomputeStreak(){
  let streak=0;
  for(let i=0;i<400;i++){
    const d=new Date(); d.setDate(d.getDate()-i); const ds=getKSTDateString(d);
    const log=S.logs[ds];
    if(log && (log.points>0 || Object.values(log.setsDoneByExId||{}).some(v=>v>0))){ streak++; } else break;
  }
  S.streak=streak; saveState(S);
}
function maybeDailyStreakBonus(dateStr){
  const log=ensureLog(dateStr);
  if(!log._streakBonusApplied && (log.points>0 || Object.values(log.setsDoneByExId||{}).some(v=>v>0))){
    recomputeStreak();
    const bonus=Math.max(0,(S.streak-1)*5);
    if(bonus>0) addPoints(dateStr, bonus);
    log._streakBonusApplied = true; saveState(S);
  }
}

// ---------- Home ----------
function renderHome(){
  const dateStr=todayStr, todays=exercisesForDate(dateStr), log=ensureLog(dateStr);
  const totalSets = todays.reduce((a,b)=>a+b.sets,0);
  const doneTotal = todays.reduce((a,b)=> a + (log.setsDoneByExId[b.id]||0), 0);
  $("#today-summary").innerHTML = `<div class="row-between">
      <div><b>${doneTotal}/${totalSets}</b> 세트 완료</div>
      <button id="btn-reset-today" class="reset-btn">오늘 기록 초기화</button>
    </div>`;
  $("#btn-reset-today").onclick = ()=>{
    const prev = ensureLog(dateStr).points||0;
    S.points = Math.max(0,(S.points||0)-prev);
    S.rankPts = Math.max(0,(S.rankPts||0)-prev);
    S.logs[dateStr] = { setsDoneByExId:{}, secondsLeftByExId:{}, points:0, memo:'' };
    saveState(S); renderHome(); renderRank(); renderQuests(); renderCalendar();
  };

  const list=$("#today-list"); list.innerHTML="";
  todays.forEach(ex=>{
    const eff=effectiveValue(ex, dateStr);
    const cell=document.createElement('div'); cell.className='cell';
    const meta = ex.type==='count' ? `${eff}회 × ${ex.sets}세트` : `${eff}초 × ${ex.sets}세트`;
    cell.innerHTML = `<div class="row-between"><div class="title-md">${ex.name}</div><div class="subtle">${meta}</div></div><div class="sets"></div>`;
    const setsWrap=$(".sets", cell); const done=log.setsDoneByExId[ex.id]||0;
    for(let i=1;i<=ex.sets;i++){
      const chip=document.createElement('button'); chip.className='set-chip'+(i<=done?' done':''); chip.textContent=`세트${i}`;
      chip.onclick=()=>{
        const cur=log.setsDoneByExId[ex.id]||0;
        if(i<=cur){ log.setsDoneByExId[ex.id]=i-1; } else { log.setsDoneByExId[ex.id]=i; addPoints(dateStr,10); }
        saveState(S); maybeDailyStreakBonus(dateStr); updateQuestProgress(dateStr);
        renderHome(); renderRank(); renderQuests(); renderCalendar();
      };
      setsWrap.appendChild(chip);
    }
    if(ex.type==='time'){
      const seconds=eff; const remain=log.secondsLeftByExId[ex.id] ?? seconds;
      const row=document.createElement('div'); row.className='timer-row';
      const disp=document.createElement('span'); disp.className='time-left'; disp.textContent=formatHM(remain*1000);
      const start=document.createElement('button'); start.className='timer-btn'; start.textContent='시작';
      const stop=document.createElement('button'); stop.className='timer-btn'; stop.textContent='정지';
      row.append(start,stop,disp); cell.appendChild(row);
      let timerId=null;
      start.onclick=()=>{
        if(timerId) return;
        let left = log.secondsLeftByExId[ex.id] ?? seconds;
        timerId=setInterval(()=>{
          left=Math.max(0,left-1); log.secondsLeftByExId[ex.id]=left; saveState(S); disp.textContent=formatHM(left*1000);
          if(left<=0){ clearInterval(timerId); timerId=null; beepShort();
            const cur=log.setsDoneByExId[ex.id]||0; if(cur<ex.sets){ log.setsDoneByExId[ex.id]=cur+1; addPoints(dateStr,10); }
            log.secondsLeftByExId[ex.id]=seconds; saveState(S); maybeDailyStreakBonus(dateStr); updateQuestProgress(dateStr);
            renderHome(); renderRank(); renderQuests(); renderCalendar();
          }
        },1000);
      };
      stop.onclick=()=>{ if(timerId){ clearInterval(timerId); timerId=null; } };
    }
    list.appendChild(cell);
  });
}

// ---------- Calendar ----------
let calCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
function renderCalendar(){
  $("#cal-title").textContent = `${calCursor.getFullYear()}-${String(calCursor.getMonth()+1).padStart(2,'0')}`;
  const grid=$("#calendar-grid"); grid.innerHTML="";
  const firstDay=new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const lastDay=new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 0);
  const startOffset=firstDay.getDay();
  for(let i=0;i<startOffset;i++){ grid.appendChild(document.createElement('div')); }
  for(let d=1; d<=lastDay.getDate(); d++){
    const date=new Date(calCursor.getFullYear(), calCursor.getMonth(), d);
    const ds=getKSTDateString(date);
    const cell=document.createElement('div'); cell.className='cell-date'; cell.innerHTML=`<div class="num">${d}</div>`;
    const todayEx=exercisesForDate(ds); const log=S.logs[ds];
    const total=todayEx.reduce((a,b)=>a+b.sets,0); const done=todayEx.reduce((a,b)=>a+(log?.setsDoneByExId?.[b.id]||0),0);
    if(total>0){ if(done===0){} else if(done<total){ cell.classList.add('partial');} else {cell.classList.add('done');} }
    if(isRestDay(ds)) cell.classList.add('rest');
    cell.onclick=()=>{
      const lines=[]; todayEx.forEach(ex=>{ const dn=log?.setsDoneByExId?.[ex.id]||0; lines.push(`• ${ex.name} — ${dn}/${ex.sets}세트`); });
      const memoText = (log&&log.memo)||'';
      $("#calendar-detail").innerHTML = `<div class="title-md" style="margin-bottom:6px">${ds}</div>
        ${ (lines.length ? `<ul class='list-reset'>${lines.map(esc).map(s=>`<li>${s}</li>`).join('')}</ul>` : `<div class='subtle'>기록 없음</div>`) }
        <div class="row-between" style="margin-top:10px">
          <input id="memo-input" placeholder="메모 입력..." value="${memoText.replace(/"/g,'&quot;')}" />
          <button id="memo-save" class="primary" style="margin-left:8px">저장</button>
        </div>`;
      $("#memo-save").onclick = ()=>{ const v=$("#memo-input").value||''; ensureLog(ds).memo=v; saveState(S); };
    };
    grid.appendChild(cell);
  }
}
$("#cal-prev").onclick=()=>{ calCursor.setMonth(calCursor.getMonth()-1); renderCalendar(); };
$("#cal-next").onclick=()=>{ calCursor.setMonth(calCursor.getMonth()+1); renderCalendar(); };

// ---------- Rank ----------
function currentRankName(){
  const p=S.rankPts;
  if(p>=2200) return "Grandmaster";
  if(p>=1500) return "Master";
  if(p>=1000) return "Diamond";
  if(p>=600) return "Platinum";
  if(p>=300) return "Gold";
  if(p>=100) return "Silver";
  return "Bronze";
}
function nextRankTarget(){
  const p=S.rankPts;
  if(p<100) return 100;
  if(p<300) return 300;
  if(p<600) return 600;
  if(p<1000) return 1000;
  if(p<1500) return 1500;
  if(p<2200) return 2200;
  return 2200;
}
function renderRank(){
  const cur=S.rankPts, name=currentRankName(), target=nextRankTarget();
  const pct=Math.min(100,Math.round((cur/target)*100));
  $("#rank-card").innerHTML = `
    <div class="row-between" style="margin-bottom:8px">
      <div class="title-md">${name}</div>
      <div class="subtle">총 포인트</div>
    </div>
    <div class="row-between" style="margin-bottom:8px">
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      <div style="font-weight:900">${cur}</div>
    </div>
    <div class="subtle">다음 랭크까지 ${Math.max(0,target-cur)}pt</div>`;
}

// ---------- Quests ----------
function genQuestsFor(dateStr){
  const todays=exercisesForDate(dateStr), qs=[];
  if(todays.length){
    const rep=todays[0]; qs.push({id:uid(), type:'rep', name:`${rep.name} ${rep.sets}세트 완료하기`, target:rep.sets, reward:20, exId:rep.id, done:0, claimed:false});
    const total = todays.reduce((a,b)=>a+b.sets,0); qs.push({id:uid(), type:'all', name:`오늘 운동 ${total}세트 전부 완료하기`, target:total, reward:30, done:0, claimed:false});
    const timeEx = todays.find(x=>x.type==='time');
    if(timeEx){ qs.push({id:uid(), type:'time', name:`${timeEx.name} ${timeEx.sets}세트 완료하기`, target:timeEx.sets, reward:25, exId:timeEx.id, done:0, claimed:false}); }
    else { qs.push({id:uid(), type:'streak', name:`연속 3일 운동하기`, target:3, reward:25, done:Math.min(S.streak,3), claimed:false}); }
  }
  return qs;
}
function ensureQuests(dateStr){
  if(S.lastQuestDate !== dateStr){
    S.questsByDate[dateStr] = genQuestsFor(dateStr);
    S.lastQuestDate = dateStr; saveState(S);
  }
  return S.questsByDate[dateStr]||[];
}
function updateQuestProgress(dateStr){
  const qs=ensureQuests(dateStr), todays=exercisesForDate(dateStr), log=ensureLog(dateStr);
  for(const q of qs){
    if(q.type==='rep' && q.exId) q.done=Math.min(q.target, (log.setsDoneByExId[q.exId]||0));
    if(q.type==='all'){ const done=todays.reduce((a,ex)=>a+(log.setsDoneByExId[ex.id]||0),0); q.done=Math.min(q.target, done); }
    if(q.type==='time' && q.exId) q.done=Math.min(q.target, (log.setsDoneByExId[q.exId]||0));
    if(q.type==='streak') q.done=Math.min(q.target, S.streak);
  }
  saveState(S);
}
function renderQuests(){
  const qs=ensureQuests(todayStr); updateQuestProgress(todayStr);
  const list=$("#quest-list"); list.innerHTML="";
  const doneCnt = qs.filter(q=>q.done>=q.target).length;
  $("#quest-progress .bar").style.width = `${Math.round(doneCnt/Math.max(1,qs.length)*100)}%`;
  qs.forEach(q=>{
    const item=document.createElement('div'); item.className='row-between cell';
    const left=document.createElement('div'); left.innerHTML=`<div class="title-md">${q.name}</div><div class="subtle">${q.done}/${q.target}</div>`;
    const right=document.createElement('div'); right.className='row gap';
    const badge=document.createElement('span'); badge.className='badge'; badge.textContent=`+${q.reward}pt`;
    const btn=document.createElement('button'); btn.className='ios-btn';
    if(q.done>=q.target && !q.claimed) btn.textContent='받기'; else if(q.claimed){ btn.textContent='지급 완료'; btn.disabled=true; btn.classList.add('badge','good'); } else { btn.textContent='진행중'; btn.disabled=true; }
    btn.onclick=()=>{ if(q.done>=q.target && !q.claimed){ addPoints(todayStr,q.reward); q.claimed=true; saveState(S); renderRank(); renderQuests(); } };
    right.append(badge, btn); item.append(left,right); list.appendChild(item);
  });
}

// ---------- Settings ----------
function renderSettings(){
  $("#start-date").value = S.startDate;
  const ndays = 1 + Math.max(0, daysBetween(S.startDate, todayStr));
  $("#ndays").textContent = `현재 ${ndays}일차`;

  const ndEl=$("#start-days"); if(ndEl) ndEl.value = ndays;
  const applyBtn=$("#start-days-apply");
  if(applyBtn) applyBtn.onclick = ()=>{
    const n=parseInt($("#start-days").value||"1",10);
    const d=new Date(); d.setDate(d.getDate()-(n-1));
    S.startDate = getKSTDateString(d); saveState(S); renderSettings(); renderHome(); renderCalendar();
  };

  const labels=['일','월','화','수','목','금','토'];
  const restWrap=$("#rest-days"); restWrap.innerHTML="";
  labels.forEach((lab,i)=>{
    const chip=document.createElement('button'); chip.className='chip'+(S.restDays.includes(i)?' active':''); chip.textContent=lab;
    chip.onclick=()=>{ const has=S.restDays.includes(i); if(has) S.restDays=S.restDays.filter(x=>x!==i); else S.restDays.push(i); saveState(S); renderSettings(); renderCalendar(); renderHome(); };
    restWrap.appendChild(chip);
  });

  const daysWrap=$("#ex-days"); daysWrap.innerHTML="";
  labels.forEach((lab,i)=>{ const c=document.createElement('button'); c.className='chip'; c.textContent=lab; c.dataset.day=i; daysWrap.appendChild(c); });
  daysWrap.onclick=(e)=>{ if(e.target.classList.contains('chip')) e.target.classList.toggle('active'); };

  $("#ex-add").onclick=()=>{
    const name=$("#ex-name").value.trim();
    const type=$("#ex-type").value; const sets=parseInt($("#ex-sets").value||'0',10);
    const base=parseInt($("#ex-base").value||'0',10); const incr=parseInt($("#ex-incr").value||'0',10);
    const days=[...daysWrap.querySelectorAll('.chip.active')].map(c=>parseInt(c.dataset.day,10));
    if(!name || sets<1 || base<1 || days.length===0){ alert('필수 항목을 확인하세요.'); return; }
    S.exercises.push({id:uid(), name, type, sets, base, weeklyIncr:incr||0, days}); saveState(S);
    $("#ex-name").value=""; $("#ex-sets").value=""; $("#ex-base").value=""; $("#ex-incr").value=""; daysWrap.querySelectorAll('.chip.active').forEach(el=>el.classList.remove('active'));
    renderSettings(); renderHome(); renderCalendar();
  };

  const exList=$("#ex-list"); exList.innerHTML="";
  S.exercises.forEach(ex=>{
    const line=document.createElement('div'); line.className='row-between';
    const daysLabel = ex.days.map(d=>labels[d]).join('');
    const meta = (ex.type==='count' ? `횟수` : `시간`) + ` • ${ex.sets}세트 • 주${ex.weeklyIncr||0}증가 • 요일: ${daysLabel}`;
    line.innerHTML=`
      <div>
        <div class="title-md">${ex.name}</div>
        <div class="subtle">${meta}</div>
      </div>
      <div class="row gap">
        <button class="ios-btn" data-act="edit">수정</button>
        <button class="ios-btn" data-act="del" style="color:#ff453a;border-color:#ff453a">삭제</button>
      </div>`;
    const btnEdit=line.querySelector('[data-act="edit"]');
    const btnDel=line.querySelector('[data-act="del"]');
    btnDel.onclick=()=>{ if(confirm('삭제할까요?')){ S.exercises=S.exercises.filter(e=>e.id!==ex.id); saveState(S); renderSettings(); renderHome(); renderCalendar(); } };
    btnEdit.onclick=()=>{
      const name=prompt("이름", ex.name); if(name===null) return;
      const type=prompt("타입(count|time)", ex.type)||ex.type;
      const sets=parseInt(prompt("세트 수", ex.sets)||ex.sets,10);
      const base=parseInt(prompt("기본값(횟수/초)", ex.base)||ex.base,10);
      const incr=parseInt(prompt("주간 증가량", ex.weeklyIncr||0)||(ex.weeklyIncr||0),10);
      const ds=prompt("요일(예: 월수금 또는 숫자 1,3,5)", daysLabel)||daysLabel;
      let days=[];
      if(/\d/.test(ds)){ days = ds.split(/\D+/).filter(Boolean).map(n=>parseInt(n,10)); }
      else { const map={일:0,월:1,화:2,수:3,목:4,금:5,토:6}; days=[...ds].map(ch=>map[ch]).filter(v=>v>=0); }
      if(!name || !sets || !base || days.length===0){ alert('값을 확인하세요'); return; }
      ex.name=name; ex.type=(type==='time'?'time':'count'); ex.sets=sets; ex.base=base; ex.weeklyIncr=incr; ex.days=days;
      saveState(S); renderSettings(); renderHome(); renderCalendar();
    };
    exList.appendChild(line);
  });

  $("#btn-export").onclick=()=>{
    const blob=new Blob([JSON.stringify(S,null,2)], {type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='oneul-workout-data.json'; a.click(); URL.revokeObjectURL(url);
  };
  $("#file-import").onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ try{ const obj=JSON.parse(reader.result); localStorage.setItem(STORE_KEY, JSON.stringify(obj)); S=loadState(); renderHome(); renderCalendar(); renderRank(); renderQuests(); renderSettings(); }catch(err){ alert('JSON 형식 오류'); } };
    reader.readAsText(file,'utf-8');
  };
}

// ---------- Boot ----------
function init(){ switchTo("home"); renderHome(); renderCalendar(); renderRank(); renderQuests(); renderSettings(); }
init();
