// 오늘운동 PWA - SPA + LocalStorage
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

  // ---------- Audio: simple beep using WebAudio
  let audioCtx;
  function unlockAudio(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination); o.start();
      setTimeout(()=>{o.stop();},10);
    }
  }
  function beep(ms=150, freq=880){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+ms/1000);
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>o.stop(), ms+20);
  }

  // ---------- State
  const initialState = {
    startDate: new Date().toISOString().slice(0,10),
    restDays: [0], // 일 휴식
    exercises: [
      {id: crypto.randomUUID(), name:"푸쉬업", type:"count", sets:3, base:10, weeklyInc:2, days:[1,3,5]},
      {id: crypto.randomUUID(), name:"스쿼트", type:"count", sets:3, base:15, weeklyInc:5, days:[2,4]},
      {id: crypto.randomUUID(), name:"플랭크", type:"time", sets:2, base:30, weeklyInc:5, days:[1,2,3,4,5]},
    ],
    history: {}, // 'YYYY-MM-DD': { completed: {exId: n}, timeDone: {exId: [seconds...] } }
    points: 0,
    lastActiveDate: null,
    streak: 0
  };

  function load(){
    try {
      return JSON.parse(localStorage.getItem("ow_state")) || initialState;
    } catch(e){
      return initialState;
    }
  }
  function save(){
    localStorage.setItem("ow_state", JSON.stringify(state));
  }
  let state = load();

  // ---------- Utilities
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  $("#today-label").textContent = `${todayStr} (${WEEKDAYS[today.getDay()]})`;

  function daysBetween(a,b){
    const d = (new Date(b).setHours(0,0,0,0) - new Date(a).setHours(0,0,0,0)) / 86400000;
    return Math.floor(d);
  }
  function weeksSinceStart(d = todayStr){
    return Math.max(0, Math.floor(daysBetween(state.startDate, d) / 7));
  }
  function isRestDay(d){
    const wd = new Date(d).getDay();
    return state.restDays.includes(wd);
  }
  function exercisesForDate(d){
    const wd = new Date(d).getDay();
    return state.exercises.filter(ex => ex.days?.includes(wd));
  }
  function targetFor(ex, d = todayStr){
    const inc = weeksSinceStart(d) * (Number(ex.weeklyInc)||0);
    return Math.max(1, Number(ex.base||0) + inc);
  }

  // ---------- Rank helpers
  function currentRank(points){
    let idx = 0;
    for(let i=0;i<RANKS.length;i++){
      if(points >= RANKS[i].need) idx = i;
    }
    const cur = RANKS[idx];
    const next = RANKS[idx+1] || RANKS[idx];
    const toNext = Math.max(0, next.need - points);
    const span = Math.max(1, next.need - cur.need);
    const prog = Math.min(100, Math.round(((points - cur.need) / span)*100));
    return {cur, next, toNext, prog};
  }

  // ---------- Tabs
  $$(".tabs .tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      unlockAudio();
      $$(".tabs .tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$(".view").forEach(v=>v.classList.remove("active"));
      $("#"+tab).classList.add("active");
      if(tab==="calendar") renderCalendar();
      if(tab==="rank") renderRank();
      if(tab==="settings") renderSettings();
      if(tab==="home") renderHome();
    });
  });

  // ---------- Home
  const cardTpl = $("#exercise-card-tpl");
  $("#reset-today").addEventListener("click", ()=>{
    const rec = state.history[todayStr];
    if(rec){ delete state.history[todayStr]; save(); renderHome(); renderCalendar(); renderRank(); }
  });

  function ensureDailyRecord(dateStr){
    state.history[dateStr] = state.history[dateStr] || { completed:{}, timeDone:{} };
  }

  function addPointsForSet(){
    // +10pt per set; streak bonus handled daily
    state.points += 10;
  }

  function endOfDayStreakCheck(dateStr){
    // If at least one set completed today, update streak continuous from yesterday
    const rec = state.history[dateStr];
    const done = rec && Object.values(rec.completed).reduce((a,b)=>a+b,0) > 0;
    if(!done) return;

    const y = new Date(dateStr); y.setDate(y.getDate()-1);
    const yStr = y.toISOString().slice(0,10);
    const yDone = state.history[yStr] && Object.values(state.history[yStr].completed).reduce((a,b)=>a+b,0) > 0;

    state.streak = yDone ? (state.streak||0)+1 : 1;
    // streak bonus: 5 * (streak-1)
    state.points += Math.max(0, 5 * (state.streak - 1));
  }

  function renderHome(){
    const wrap = $("#today-exercises");
    wrap.innerHTML = "";
    const list = exercisesForDate(todayStr);
    const rest = isRestDay(todayStr);

    ensureDailyRecord(todayStr);
    const rec = state.history[todayStr];

    if(rest){
      wrap.innerHTML = `<div class="card"><strong>휴식일</strong>로 설정되어 있습니다. 설정에서 변경할 수 있어요.</div>`;
      $("#sets-total").textContent = "0";
      $("#sets-done").textContent = "0";
      return;
    }

    let totalSets = 0, doneSets = 0;

    list.forEach(ex=>{
      const node = cardTpl.content.firstElementChild.cloneNode(true);
      $(".ex-name", node).textContent = ex.name;

      const tgt = targetFor(ex);
      $(".ex-target", node).textContent = ex.type==="count" ? `${tgt}회 × ${ex.sets}세트` : `${tgt}초 × ${ex.sets}세트`;

      const setsWrap = $(".sets", node);
      const done = rec.completed[ex.id] || 0;
      for(let i=1;i<=ex.sets;i++){
        const b = document.createElement("button");
        b.textContent = `세트 ${i}`;
        if(i <= done) b.classList.add("done");
        b.addEventListener("click", ()=>{
          unlockAudio();
          ensureDailyRecord(todayStr);
          const cur = state.history[todayStr].completed[ex.id] || 0;
          if(i <= cur){
            // uncheck this and after
            state.history[todayStr].completed[ex.id] = i-1;
            state.points = Math.max(0, state.points - 10); // revert points if unchecking
          } else {
            state.history[todayStr].completed[ex.id] = i;
            addPointsForSet();
          }
          save(); renderHome(); renderCalendar(); renderRank();
        });
        setsWrap.appendChild(b);
      }

      totalSets += ex.sets;
      doneSets += done;

      // Timer UI for time-based exercises
      if(ex.type === "time"){
        const trow = $(".timer-row", node);
        trow.classList.remove("hidden");
        const ts = $(".timer", trow);
        let remain = tgt;
        let timerId = null;

        function updateLabel(){
          const m = String(Math.floor(remain/60)).padStart(2,"0");
          const s = String(remain%60).padStart(2,"0");
          ts.textContent = `${m}:${s}`;
        }
        updateLabel();

        trow.addEventListener("click", (e)=>{
          const action = e.target.dataset.action;
          if(action==="start"){
            unlockAudio();
            if(timerId) return;
            timerId = setInterval(()=>{
              remain--;
              updateLabel();
              if(remain <= 0){
                clearInterval(timerId); timerId = null; remain = 0; updateLabel();
                beep(200, 1000); setTimeout(()=>beep(160, 700), 220);
                // auto mark one set if any left unchecked
                const cur = state.history[todayStr].completed[ex.id] || 0;
                if(cur < ex.sets){
                  state.history[todayStr].completed[ex.id] = cur+1;
                  addPointsForSet();
                  save(); renderHome(); renderCalendar(); renderRank();
                }
              }
            }, 1000);
          } else if(action==="stop"){
            if(timerId){ clearInterval(timerId); timerId = null; beep(60,600); }
          }
        });
      }

      wrap.appendChild(node);
    });

    $("#sets-total").textContent = totalSets;
    $("#sets-done").textContent = doneSets;

    // End-of-day streak bonus application: apply once per day on first open after midnight
    if(state.lastActiveDate !== todayStr){
      endOfDayStreakCheck(todayStr);
      state.lastActiveDate = todayStr;
      save();
    }
  }

  // ---------- Calendar
  let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  $("#prev-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()-1); renderCalendar(); });
  $("#next-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()+1); renderCalendar(); });

  function renderCalendar(){
    $("#month-title").textContent = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth()+1}월`;
    const grid = $("#calendar-grid"); grid.innerHTML = "";
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startIdx = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();

    // Headings
    WEEKDAYS.forEach(d => {
      const h = document.createElement("div");
      h.className = "cell muted"; h.textContent = d;
      grid.appendChild(h);
    });

    for(let i=0;i<startIdx;i++){
      const empty = document.createElement("div"); empty.className = "cell muted"; empty.textContent = ""; grid.appendChild(empty);
    }
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d).toISOString().slice(0,10);
      const cell = document.createElement("div");
      cell.className = "cell";
      const dayDone = state.history[dateStr] && Object.values(state.history[dateStr].completed).reduce((a,b)=>a+b,0) || 0;
      const todaysExercises = exercisesForDate(dateStr).reduce((a,ex)=>a+ex.sets,0);
      if(isRestDay(dateStr)) cell.classList.add("rest");
      if(dayDone >= todaysExercises && todaysExercises>0) cell.classList.add("done");
      else if(dayDone > 0) cell.classList.add("partial");
      cell.innerHTML = `<span class="d">${d}</span>`;
      cell.addEventListener("click", ()=> showDayDetail(dateStr));
      grid.appendChild(cell);
    }
    $("#day-detail").textContent = "날짜를 탭하면 상세 기록이 보여요.";
  }

  function showDayDetail(dateStr){
    const list = exercisesForDate(dateStr);
    const rec = state.history[dateStr] || {completed:{}};
    const items = list.map(ex=>{
      const c = rec.completed[ex.id]||0;
      return `• ${ex.name} — ${c}/${ex.sets}세트`;
    }).join("<br>");
    $("#day-detail").innerHTML = `<strong>${dateStr}</strong><br>${items || "기록 없음"}`;
  }

  // ---------- Rank
  function renderRank(){
    const {cur, next, toNext, prog} = currentRank(state.points);
    $("#rank-name").textContent = cur.name;
    $("#points").textContent = state.points;
    $("#to-next").textContent = toNext;
    $("#rank-progress").style.width = prog + "%";
    $("#next-rank-label").textContent = (next.name===cur.name) ? "최고 랭크" : `${next.name}까지`;
  }

  // ---------- Settings
  function renderSettings(){
    $("#start-date").value = state.startDate;
    const nth = daysBetween(state.startDate, todayStr)+1;
    $("#nth-day").textContent = nth;

    // rest
    $$("#rest-days input[type=checkbox]").forEach(cb=>{
      cb.checked = state.restDays.includes(Number(cb.value));
      cb.addEventListener("change", ()=>{
        const v = Number(cb.value);
        if(cb.checked) { if(!state.restDays.includes(v)) state.restDays.push(v); }
        else { state.restDays = state.restDays.filter(x=>x!==v); }
        save(); renderHome(); renderCalendar();
      });
    });

    // list
    const list = $("#exercise-list");
    list.innerHTML = "";
    state.exercises.forEach(ex=>{
      const item = document.createElement("div");
      item.className = "row space";
      const meta = document.createElement("div");
      meta.innerHTML = `<strong>${ex.name}</strong> <span class="muted">${ex.type==="count" ? "횟수" : "시간"} · ${ex.sets}세트 · 주${ex.weeklyInc}증가 · 요일:${(ex.days||[]).map(d=>WEEKDAYS[d]).join("")}</span>`;
      const del = document.createElement("button");
      del.className = "ghost"; del.textContent = "삭제";
      del.addEventListener("click", ()=>{
        state.exercises = state.exercises.filter(e=>e.id!==ex.id);
        // purge history of this id
        Object.keys(state.history).forEach(k=>{
          if(state.history[k]?.completed?.[ex.id]!=null) delete state.history[k].completed[ex.id];
        });
        save(); renderSettings(); renderHome(); renderCalendar();
      });
      item.appendChild(meta); item.appendChild(del);
      list.appendChild(item);
    });
  }

  $("#start-date").addEventListener("change", (e)=>{
    state.startDate = e.target.value || state.startDate;
    save(); renderSettings(); renderHome(); renderCalendar();
  });

  $("#add-exercise").addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const days = fd.getAll("days").map(Number);
    const ex = {
      id: crypto.randomUUID(),
      name: fd.get("name").trim(),
      type: fd.get("type"),
      sets: Number(fd.get("sets"))||1,
      base: Number(fd.get("base"))||1,
      weeklyInc: Number(fd.get("weeklyInc"))||0,
      days
    };
    if(!ex.name){ return; }
    state.exercises.push(ex); save(); e.target.reset();
    renderSettings(); renderHome(); renderCalendar();
  });

  $("#export-json").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "oneul-workout-data.json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });
  $("#import-json").addEventListener("change", (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const incoming = JSON.parse(fr.result);
        state = Object.assign({}, state, incoming);
        save(); renderSettings(); renderHome(); renderCalendar(); renderRank();
      }catch(err){ alert("불러오기 실패: "+err.message); }
    };
    fr.readAsText(file);
  });

  // ---------- Init
  document.addEventListener("click", unlockAudio, {once:true});
  renderHome(); renderCalendar(); renderRank(); renderSettings();
})();