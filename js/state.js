// Global state & utilities for 오늘운동
window.OW = (function(){
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

  let audioCtx;
  function unlockAudioOnce(){
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

  const initialState = {
    startDate: new Date().toISOString().slice(0,10),
    restDays: [0],
    exercises: [
      {id: crypto.randomUUID(), name:"푸쉬업", type:"count", sets:3, base:10, weeklyInc:2, days:[1,3,5]},
      {id: crypto.randomUUID(), name:"스쿼트", type:"count", sets:3, base:15, weeklyInc:5, days:[2,4]},
      {id: crypto.randomUUID(), name:"플랭크", type:"time", sets:2, base:30, weeklyInc:5, days:[1,2,3,4,5]},
    ],
    history: {},
    points: 0,
    lastActiveDate: null,
    streak: 0
  };

  function load(){
    try { return JSON.parse(localStorage.getItem("ow_state")) || initialState; }
    catch(e){ return initialState; }
  }
  function save(){ localStorage.setItem("ow_state", JSON.stringify(state)); }
  let state = load();

  // time helpers
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
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

  function ensureDailyRecord(dateStr){
    state.history[dateStr] = state.history[dateStr] || { completed:{}, timeDone:{} };
  }
  function addPointsForSet(){ state.points += 10; }
  function endOfDayStreakCheck(dateStr){
    const rec = state.history[dateStr];
    const done = rec && Object.values(rec.completed).reduce((a,b)=>a+b,0) > 0;
    if(!done) return;
    const y = new Date(dateStr); y.setDate(y.getDate()-1);
    const yStr = y.toISOString().slice(0,10);
    const yDone = state.history[yStr] && Object.values(state.history[yStr].completed).reduce((a,b)=>a+b,0) > 0;
    state.streak = yDone ? (state.streak||0)+1 : 1;
    state.points += Math.max(0, 5 * (state.streak - 1));
  }

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

  // header label
  document.addEventListener("DOMContentLoaded", ()=>{
    const label = document.getElementById("today-label");
    if(label){
      const WEEK = WEEKDAYS[new Date().getDay()];
      label.textContent = `${todayStr} (${WEEK})`;
    }
    document.addEventListener("click", unlockAudioOnce, {once:true});
    if(state.lastActiveDate !== todayStr){
      endOfDayStreakCheck(todayStr);
      state.lastActiveDate = todayStr;
      save();
    }
  });

  return {
    state, save, todayStr,
    WEEKDAYS, RANKS,
    isRestDay, exercisesForDate, targetFor,
    ensureDailyRecord, addPointsForSet, endOfDayStreakCheck,
    currentRank, beep
  };
})();