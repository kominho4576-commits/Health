// 오늘운동 PWA — v3.4.1
(function(){
  const $ = (sel, el=document)=> el.querySelector(sel);
  const $$ = (sel, el=document)=> Array.from(el.querySelectorAll(sel));

  const WEEKDAYS = ["일","월","화","수","목","금","토"];
  const RANKS = [
    {name:"Bronze", need:0},
    {name:"Silver", need:500},
    {name:"Gold", need:1200},
    {name:"Platinum", need:2200},
    {name:"Diamond", need:3500},
    {name:"Master", need:5200},
    {name:"GrandMaster", need:7500}
  ];

  // Audio
  let audioCtx;
  function unlockAudio(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.0001; o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>o.stop(),10);
    }
  }
  function beep(ms=150, freq=880){
    if(!audioCtx) return;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+ms/1000);
    o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>o.stop(), ms+20);
  }

  // Dates
  function pad(n){return String(n).padStart(2,'0');}
  function localDateStr(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}

  // State
  const initialState = {
    startDate: localDateStr(new Date()),
    restDays: [0],
    exercises: [
      {id: crypto.randomUUID(), name:"푸쉬업", type:"count", sets:3, base:10, weeklyInc:2, days:[1,3,5]},
      {id: crypto.randomUUID(), name:"스쿼트", type:"count", sets:3, base:15, weeklyInc:5, days:[2,4]},
      {id: crypto.randomUUID(), name:"플랭크", type:"time", sets:2, base:30, weeklyInc:5, days:[1,2,3,4,5]},
    ],
    history: {},
    points: 0,
    lastActiveDate: null,
    streak: 0,
    dailyPoints: {},
    questsClaimed: {},
  };
  function load(){ try { return JSON.parse(localStorage.getItem("ow_state")) || initialState; } catch(e){ return initialState; } }
  function save(){ localStorage.setItem("ow_state", JSON.stringify(state)); }
  let state = load();

  const today = new Date(); const todayStr = localDateStr(today);
  $("#today-label").textContent = `${todayStr} (${WEEKDAYS[today.getDay()]})`;

  function daysBetween(a,b){ const d=(new Date(b).setHours(0,0,0,0)-new Date(a).setHours(0,0,0,0))/86400000; return Math.floor(d); }
  function weeksSinceStart(d=todayStr){ return Math.max(0, Math.floor(daysBetween(state.startDate, d)/7)); }
  function isRestDay(d){ const wd = new Date(d).getDay(); return state.restDays.includes(wd); }
  function exercisesForDate(d){ const wd = new Date(d).getDay(); return state.exercises.filter(ex=> ex.days?.includes(wd)); }
  function targetFor(ex, d=todayStr){ const inc = weeksSinceStart(d) * (Number(ex.weeklyInc)||0); return Math.max(1, Number(ex.base||0)+inc); }

  // Rank helpers
  function currentRank(points){
    let idx = 0; for(let i=0;i<RANKS.length;i++) if(points >= RANKS[i].need) idx = i;
    const cur=RANKS[idx], next=RANKS[idx+1]||RANKS[idx];
    const toNext = Math.max(0, next.need - points);
    const span = Math.max(1, next.need - cur.need);
    const prog = Math.min(100, Math.round(((points - cur.need) / span)*100));
    return {cur,next,toNext,prog};
  }

  // Router
  const VIEWS = ["home","calendar","rank","settings"];
  function showView(id){
    VIEWS.forEach(v=>{
      const isActive=(v===id);
      $("#"+v)?.setAttribute("aria-hidden", String(!isActive));
      $("#tab-"+v)?.setAttribute("aria-selected", String(isActive));
    });
    const active=$("#"+id); const focusEl=active.querySelector("h3, h2, button, input, select, [tabindex]");
    if(focusEl){ focusEl.focus({preventScroll:true}); }
    if(id==="home") renderHome();
    if(id==="calendar") renderCalendar();
    if(id==="rank") renderRank();
    if(id==="settings") renderSettings();
  }
  function routeFromHash(){ const hash=(location.hash||"#home").replace("#",""); const id = VIEWS.includes(hash)?hash:"home"; showView(id); }
  window.addEventListener("hashchange", routeFromHash);
  $$(".tabs .tab").forEach(btn=> btn.addEventListener("click", ()=>{ unlockAudio(); const tab=btn.dataset.tab; if(!tab) return; if(location.hash!=="#"+tab) location.hash="#"+tab; else routeFromHash(); }));

  // Daily helpers
  function ensureDailyRecord(dateStr){ state.history[dateStr] = state.history[dateStr] || { completed:{}, timeDone:{} }; }
  function addDailyPoints(dateStr, amt){ state.dailyPoints[dateStr] = (state.dailyPoints[dateStr]||0) + amt; state.points = Math.max(0, (state.points||0)+amt); }
  function addPointsForSet(){ addDailyPoints(todayStr, 10); }
  function endOfDayStreakCheck(dateStr){
    const rec = state.history[dateStr];
    const done = rec && Object.values(rec.completed).reduce((a,b)=>a+b,0) > 0;
    if(!done) return;
    const y = new Date(dateStr); y.setDate(y.getDate()-1);
    const yStr = localDateStr(y);
    const yDone = state.history[yStr] && Object.values(state.history[yStr].completed).reduce((a,b)=>a+b,0) > 0;
    state.streak = yDone ? (state.streak||0)+1 : 1;
    const bonus = Math.max(0, 5 * (state.streak - 1)); addDailyPoints(dateStr, bonus);
  }

  // Home
  const cardTpl = $("#exercise-card-tpl");
  $("#reset-today").addEventListener("click", ()=>{
    const rec = state.history[todayStr];
    if(rec){
      const earned = state.dailyPoints?.[todayStr] || 0;
      state.points = Math.max(0, (state.points||0) - earned);
      if(state.dailyPoints) delete state.dailyPoints[todayStr];
      if(state.questsClaimed?.[todayStr]) delete state.questsClaimed[todayStr];
      delete state.history[todayStr];
      save(); renderHome(); renderCalendar(); renderRank();
    }
  });

  function renderHome(){
    const wrap = $("#today-exercises"); wrap.innerHTML = "";
    const list = exercisesForDate(todayStr);
    const rest = isRestDay(todayStr);

    ensureDailyRecord(todayStr);
    const rec = state.history[todayStr];

    if(rest){
      wrap.innerHTML = `<div class="card"><strong>휴식일</strong>로 설정되어 있습니다. 설정에서 변경할 수 있어요.</div>`;
      $("#sets-total").textContent = "0"; $("#sets-done").textContent = "0"; return;
    }

    let totalSets=0, doneSets=0;
    list.forEach(ex=>{
      const node = cardTpl.content.firstElementChild.cloneNode(true);
      $(".ex-name", node).textContent = ex.name;
      const tgt = targetFor(ex);
      $(".ex-target", node).textContent = ex.type==="count" ? `${tgt}회 × ${ex.sets}세트` : `${tgt}초 × ${ex.sets}세트`;
      const setsWrap = $(".sets", node);
      const done = rec.completed[ex.id] || 0;
      for(let i=1;i<=ex.sets;i++){
        const b = document.createElement("button");
        b.className = "large-tap"; b.textContent = `세트 ${i}`;
        if(i <= done) b.classList.add("done");
        b.addEventListener("click", ()=>{
          unlockAudio(); ensureDailyRecord(todayStr);
          const cur = state.history[todayStr].completed[ex.id] || 0;
          if(i <= cur){ state.history[todayStr].completed[ex.id] = i-1; state.points = Math.max(0, state.points - 10); state.dailyPoints[todayStr] = Math.max(0, (state.dailyPoints[todayStr]||0) - 10); }
          else { state.history[todayStr].completed[ex.id] = i; addPointsForSet(); }
          save(); renderHome(); renderCalendar(); renderRank();
        });
        setsWrap.appendChild(b);
      }
      totalSets += ex.sets; doneSets += done;

      // Timer
      if(ex.type==="time"){
        const trow=$(".timer-row", node); trow.classList.remove("hidden");
        const ts=$(".timer",trow); let remain=tgt, timerId=null;
        function updateLabel(){ const m=String(Math.floor(remain/60)).padStart(2,"0"); const s=String(remain%60).padStart(2,"0"); ts.textContent=`${m}:${s}`; }
        updateLabel();
        trow.addEventListener("click",(e)=>{
          const action=e.target.dataset.action;
          if(action==="start"){
            unlockAudio(); if(timerId) return;
            timerId=setInterval(()=>{
              remain--; updateLabel();
              if(remain<=0){
                clearInterval(timerId); timerId=null; remain=0; updateLabel();
                beep(200, 1000); setTimeout(()=>beep(160,700),220);
                const cur=state.history[todayStr].completed[ex.id]||0;
                if(cur<ex.sets){ state.history[todayStr].completed[ex.id]=cur+1; addPointsForSet(); save(); renderHome(); renderCalendar(); renderRank(); }
              }
            },1000);
          }else if(action==="stop"){ if(timerId){ clearInterval(timerId); timerId=null; beep(60,600);} }
        });
      }

      wrap.appendChild(node);
    });
    $("#sets-total").textContent = totalSets; $("#sets-done").textContent = doneSets;
    if(state.lastActiveDate !== todayStr){ endOfDayStreakCheck(todayStr); state.lastActiveDate = todayStr; save(); }
  }

  // Calendar
  let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  $("#prev-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()-1); renderCalendar(); });
  $("#next-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()+1); renderCalendar(); });
  function renderCalendar(){
    $("#month-title").textContent = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth()+1}월`;
    const grid=$("#calendar-grid"); grid.innerHTML="";
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startIdx = first.getDay(); const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
    WEEKDAYS.forEach(d=>{ const h=document.createElement("div"); h.className="cell muted"; h.textContent=d; grid.appendChild(h); });
    for(let i=0;i<startIdx;i++){ const empty=document.createElement("div"); empty.className="cell muted"; grid.appendChild(empty); }
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = localDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
      const cell = document.createElement("div"); cell.className="cell";
      const dayDone = state.history[dateStr] && Object.values(state.history[dateStr].completed).reduce((a,b)=>a+b,0) || 0;
      const todaysExercises = exercisesForDate(dateStr).reduce((a,ex)=>a+ex.sets,0);
      if(isRestDay(dateStr)) cell.classList.add("rest");
      if(dayDone >= todaysExercises && todaysExercises>0) cell.classList.add("done");
      else if(dayDone > 0) cell.classList.add("partial");
      cell.innerHTML = `<span class="d">${d}</span>`;
      cell.addEventListener("click", ()=> showDayDetail(dateStr));
      grid.appendChild(cell);
    }
    $("#day-detail").textContent="날짜를 탭하면 상세 기록이 보여요.";
  }
  function showDayDetail(dateStr){
    const list=exercisesForDate(dateStr); const rec=state.history[dateStr]||{completed:{}};
    const items=list.map(ex=>{ const c=rec.completed[ex.id]||0; return `• ${ex.name} — ${c}/${ex.sets}세트`; }).join("<br>");
    $("#day-detail").innerHTML = `<strong>${dateStr}</strong><br>${items || "기록 없음"}`;
  }

  // Rank + Quests
  function renderRank(){
    const {cur, next, toNext, prog} = currentRank(state.points||0);
    $("#rank-name").textContent = cur.name; $("#points").textContent = state.points||0;
    $("#to-next").textContent = toNext; $("#rank-progress").style.width = prog + "%";
    $("#next-rank-label").textContent = (next.name===cur.name) ? "최고 랭크" : `${next.name}까지`;

    const qDate = todayStr; $("#quest-date-label").textContent=qDate;
    state.questsClaimed = state.questsClaimed || {}; const claimed = state.questsClaimed[qDate] || {};
    const rec = state.history[qDate] || {completed:{}};
    const setsDone = Object.values(rec.completed).reduce((a,b)=>a+b,0);
    const plank = (state.exercises||[]).find(e=>e.name.includes("플랭크") || e.name.toLowerCase().includes("plank"));
    const plankTarget = plank ? targetFor(plank, qDate) : 0; const plankDone = plank ? (rec.completed[plank.id]||0) > 0 : false;

    function computeStreakUpTo(dateStr){
      let streak=0; let d=new Date(dateStr);
      while(true){
        const ds = localDateStr(d);
        const r = state.history[ds];
        const done = r && Object.values(r.completed).reduce((a,b)=>a+b,0) > 0;
        if(done){ streak++; d.setDate(d.getDate()-1); } else break;
      }
      return streak;
    }
    const streakToday = computeStreakUpTo(qDate);

    const quests = [
      {id:'q_sets6', name:'오늘 세트 6개 완료', reward:20, met: setsDone >= 6},
      {id:'q_streak3', name:'연속 3일 운동', reward:30, met: streakToday >= 3},
      {id:'q_plank100', name:'플랭크 100초 이상', reward:20, met: plankDone && plankTarget >= 100},
    ];
    const totalQ = quests.length;
    const claimedCount = quests.reduce((n,q)=> n + (claimed[q.id] ? 1 : 0), 0);
    const metCount = quests.reduce((n,q)=> n + (q.met ? 1 : 0), 0);
    const progPct = Math.round((claimedCount / totalQ) * 100);
    $("#quest-progress").style.width = progPct + "%";
    $("#quest-status-label").textContent = `${claimedCount}/${totalQ} 완료 · 달성 ${metCount}/${totalQ}`;

    const list=$("#quest-list"); list.innerHTML="";
    quests.forEach(q=>{
      const li=document.createElement("li");
      const left=document.createElement("span"); left.className="q-name"; left.textContent=q.name; li.appendChild(left);
      const right=document.createElement("div"); right.className="status row"; right.style.gap=".5rem";
      const reward=document.createElement("span"); reward.className="q-reward badge"; reward.textContent = `+${q.reward}pt`; right.appendChild(reward);
      if(q.met){
        if(claimed[q.id]){
          const done=document.createElement("span"); done.className="done-badge"; done.textContent="지급 완료"; right.appendChild(done);
        }else{
          const btn=document.createElement("button"); btn.className="ghost tiny"; btn.textContent="받기";
          btn.addEventListener("click", ()=>{
            state.questsClaimed[qDate] = state.questsClaimed[qDate] || {};
            if(!state.questsClaimed[qDate][q.id]){
              addDailyPoints(qDate, q.reward); state.questsClaimed[qDate][q.id]=true; save(); renderRank();
            }
          });
          right.appendChild(btn);
        }
      }else{
        const pending=document.createElement("span"); pending.className="muted"; pending.textContent="진행중"; right.appendChild(pending);
      }
      li.appendChild(right); list.appendChild(li);
    });
  }

  // Settings
  function renderSettings(){
    $("#start-date").value = state.startDate;
    $("#nth-day").textContent = daysBetween(state.startDate, localDateStr(new Date())) + 1;
    $$("#rest-days input[type=checkbox]").forEach(cb=>{
      cb.checked = state.restDays.includes(Number(cb.value));
      cb.onchange = ()=>{
        const v=Number(cb.value);
        if(cb.checked){ if(!state.restDays.includes(v)) state.restDays.push(v); }
        else { state.restDays = state.restDays.filter(x=>x!==v); }
        save(); renderHome(); renderCalendar();
      };
    });
    const list = $("#exercise-list"); list.innerHTML="";
    state.exercises.forEach(ex=>{
      const item=document.createElement("div"); item.className="row space";
      const meta=document.createElement("div");
      meta.innerHTML = `<div class="line1"><strong>${ex.name}</strong></div>` +
                       `<div class="line2 muted">${ex.type==="count" ? "횟수" : "시간"} • ${ex.sets}세트 • 주${ex.weeklyInc}증가 • 요일: ${(ex.days||[]).map(d=>WEEKDAYS[d]).join("")}</div>`;
      const del=document.createElement("button"); del.className="ghost delete large-tap"; del.textContent="삭제";
      del.addEventListener("click", ()=>{
        state.exercises = state.exercises.filter(e=>e.id!==ex.id);
        Object.keys(state.history).forEach(k=>{ if(state.history[k]?.completed?.[ex.id]!=null) delete state.history[k].completed[ex.id]; });
        save(); renderSettings(); renderHome(); renderCalendar();
      });
      item.appendChild(meta); item.appendChild(del); list.appendChild(item);
    });
  }
  $("#start-date").addEventListener("change", (e)=>{ state.startDate = e.target.value || state.startDate; save(); renderSettings(); renderHome(); renderCalendar(); });
  $("#add-exercise").addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const ex={
      id: crypto.randomUUID(),
      name: (fd.get("name")||"").trim(),
      type: fd.get("type"),
      sets: Number(fd.get("sets"))||1,
      base: Number(fd.get("base"))||1,
      weeklyInc: Number(fd.get("weeklyInc"))||0,
      days: fd.getAll("days").map(Number)
    };
    if(!ex.name){ return; }
    state.exercises.push(ex); save(); e.target.reset(); renderSettings(); renderHome(); renderCalendar();
  });
  $("#export-json").addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="oneul-workout-data.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("#import-json").addEventListener("change", (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const fr=new FileReader(); fr.onload=()=>{ try{ const incoming=JSON.parse(fr.result); state = Object.assign({}, state, incoming); save(); renderSettings(); renderHome(); renderCalendar(); renderRank(); } catch(err){ alert("불러오기 실패: "+err.message); } }; fr.readAsText(file);
  });

  document.addEventListener("click", unlockAudio, {once:true});
  renderHome(); renderCalendar(); renderRank(); renderSettings(); routeFromHash();
})();