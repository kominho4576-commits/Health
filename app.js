(function(){
  const $=(s,el=document)=>el.querySelector(s); const $$=(s,el=document)=>Array.from(el.querySelectorAll(s));
  const WEEKDAYS=["일","월","화","수","목","금","토"];
  function pad(n){return String(n).padStart(2,'0')} function localDateStr(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}

  const initialState={startDate:localDateStr(new Date()),restDays:[0],exercises:[{id:crypto.randomUUID(),name:"푸쉬업",type:"count",sets:3,base:10,weeklyInc:2,days:[1,3,5]},{id:crypto.randomUUID(),name:"스쿼트",type:"count",sets:3,base:15,weeklyInc:5,days:[2,4]},{id:crypto.randomUUID(),name:"플랭크",type:"time",sets:2,base:30,weeklyInc:5,days:[1,2,3,4,5]}],history:{},points:0,lastActiveDate:null,streak:0,dailyPoints:{},questsClaimed:{}};
  function load(){try{return JSON.parse(localStorage.getItem("ow_state"))||initialState}catch(e){return initialState}} function save(){localStorage.setItem("ow_state",JSON.stringify(state))}
  let state=load();

  const today=new Date(); const todayStr=localDateStr(today); $("#today-label").textContent=`${todayStr} (${WEEKDAYS[today.getDay()]})`;
  function daysBetween(a,b){return Math.floor((new Date(b).setHours(0,0,0,0)-new Date(a).setHours(0,0,0,0))/86400000)}
  function weeksSinceStart(d=todayStr){return Math.max(0,Math.floor(daysBetween(state.startDate,d)/7))}
  function isRestDay(d){const wd=new Date(d).getDay();return state.restDays.includes(wd)}
  function exercisesForDate(d){const wd=new Date(d).getDay();return state.exercises.filter(ex=>ex.days?.includes(wd))}
  function targetFor(ex,d=todayStr){const inc=weeksSinceStart(d)*(Number(ex.weeklyInc)||0);return Math.max(1,Number(ex.base||0)+inc)}

  // points
  function addDailyPoints(dateStr,amt){state.dailyPoints[dateStr]=(state.dailyPoints[dateStr]||0)+amt;state.points=Math.max(0,(state.points||0)+amt)}
  function ensureDailyRecord(dateStr){state.history[dateStr]=state.history[dateStr]||{completed:{},timeDone:{}}}
  function addPointsForSet(){addDailyPoints(todayStr,10)}

  // Home
  const cardTpl=$("#exercise-card-tpl");
  $("#reset-today").addEventListener("click",()=>{const rec=state.history[todayStr];if(rec){const earned=state.dailyPoints?.[todayStr]||0;state.points=Math.max(0,(state.points||0)-earned);delete state.dailyPoints[todayStr];delete state.questsClaimed[todayStr];delete state.history[todayStr];save();renderHome();renderCalendar();renderRank();}});
  function renderHome(){
    const wrap=$("#today-exercises");wrap.innerHTML=""; const list=exercisesForDate(todayStr); ensureDailyRecord(todayStr); const rec=state.history[todayStr];
    if(isRestDay(todayStr)){wrap.innerHTML=`<div class="card"><strong>휴식일</strong>로 설정되어 있습니다.</div>`;$("#sets-total").textContent="0";$("#sets-done").textContent="0";return;}
    let total=0,doneAll=0;
    list.forEach(ex=>{const node=cardTpl.content.firstElementChild.cloneNode(true); $(".ex-name",node).textContent=ex.name; const tgt=targetFor(ex); $(".ex-target",node).textContent=ex.type==="count"?`${tgt}회 × ${ex.sets}세트`:`${tgt}초 × ${ex.sets}세트`; const setsWrap=$(".sets",node); const done=rec.completed[ex.id]||0;
      for(let i=1;i<=ex.sets;i++){const b=document.createElement("button"); b.className="large-tap"; b.textContent=`세트 ${i}`; if(i<=done)b.classList.add("done"); b.addEventListener("click",()=>{const cur=state.history[todayStr].completed[ex.id]||0; if(i<=cur){state.history[todayStr].completed[ex.id]=i-1; state.points=Math.max(0,state.points-10); state.dailyPoints[todayStr]=Math.max(0,(state.dailyPoints[todayStr]||0)-10);} else {state.history[todayStr].completed[ex.id]=i; addPointsForSet();} save();renderHome();renderCalendar();renderRank();}); setsWrap.appendChild(b)}
      total+=ex.sets; doneAll+=done; wrap.appendChild(node);
    });
    $("#sets-total").textContent=total; $("#sets-done").textContent=doneAll;
  }

  // Calendar
  let viewMonth=new Date(today.getFullYear(),today.getMonth(),1);
  $("#prev-month").addEventListener("click",()=>{viewMonth.setMonth(viewMonth.getMonth()-1);renderCalendar()});
  $("#next-month").addEventListener("click",()=>{viewMonth.setMonth(viewMonth.getMonth()+1);renderCalendar()});
  function renderCalendar(){ $("#month-title").textContent=`${viewMonth.getFullYear()}년 ${viewMonth.getMonth()+1}월`; const grid=$("#calendar-grid"); grid.innerHTML="";
    const first=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1); const startIdx=first.getDay(); const daysInMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
    WEEKDAYS.forEach(d=>{const h=document.createElement("div");h.className="cell muted";h.textContent=d;grid.appendChild(h)});
    for(let i=0;i<startIdx;i++){const e=document.createElement("div");e.className="cell muted";grid.appendChild(e)}
    for(let d=1;d<=daysInMonth;d++){const dateStr=localDateStr(new Date(viewMonth.getFullYear(),viewMonth.getMonth(),d)); const cell=document.createElement("div"); cell.className="cell"; const dayDone=state.history[dateStr]&&Object.values(state.history[dateStr].completed).reduce((a,b)=>a+b,0)||0; const todaysSets=exercisesForDate(dateStr).reduce((a,e)=>a+e.sets,0); if(dayDone>=todaysSets&&todaysSets>0)cell.classList.add("done"); else if(dayDone>0)cell.classList.add("partial"); cell.innerHTML=`<span class="d">${d}</span>`; cell.addEventListener("click",()=>showDayDetail(dateStr)); grid.appendChild(cell) }
    $("#day-detail").textContent="날짜를 탭하면 상세 기록이 보여요.";
  }
  function showDayDetail(dateStr){ const list=exercisesForDate(dateStr); const rec=state.history[dateStr]||{completed:{}}; const items=list.map(ex=>{const c=rec.completed[ex.id]||0; return `• ${ex.name} — ${c}/${ex.sets}세트`}).join("<br>"); $("#day-detail").innerHTML=`<strong>${dateStr}</strong><br>${items||"기록 없음"}` }

  // Rank + dynamic quests
  function renderRank(){
    // rank
    const need=[0,500,1200,2200,3500,5200,7500];
    function curRank(p){let idx=0;for(let i=0;i<need.length;i++)if(p>=need[i])idx=i;return {cur:idx,next:Math.min(idx+1,need.length-1),need}}
    const rr=curRank(state.points||0); const toNext=Math.max(0, rr.need[rr.next]-(state.points||0)); const span=Math.max(1, rr.need[rr.next]-rr.need[rr.cur]); const prog=Math.min(100,Math.round(((state.points||0)-rr.need[rr.cur])/span*100));
    $("#rank-name").textContent=["Bronze","Silver","Gold","Platinum","Diamond","Master","GrandMaster"][rr.cur]; $("#points").textContent=state.points||0; $("#to-next").textContent=toNext; $("#rank-progress").style.width=prog+"%"; $("#next-rank-label").textContent= rr.cur===rr.next? "최고 랭크" : `${["Bronze","Silver","Gold","Platinum","Diamond","Master","GrandMaster"][rr.next]}까지`;

    const qDate=todayStr; $("#quest-date-label").textContent=qDate; const rec=state.history[qDate]||{completed:{}};
    function buildDailyQuests(dateStr){
      const todays=exercisesForDate(dateStr); const rec=state.history[dateStr]||{completed:{}}; const list=[];
      const exCount=todays.find(e=>e.type==='count'); if(exCount){list.push({id:'q_ex_'+exCount.id,name:`${exCount.name} 세트 모두 완료`,reward:20,met:(rec.completed[exCount.id]||0)>=exCount.sets})}
      const exTime=todays.find(e=>e.type==='time'); if(exTime){const tgt=targetFor(exTime,dateStr); list.push({id:'q_time_'+exTime.id,name:`${exTime.name} ${tgt}초 1세트 완료`,reward:20,met:(rec.completed[exTime.id]||0)>=1})}
      const total=todays.reduce((a,e)=>a+e.sets,0);
      if(total<=6){list.push({id:'q_all_complete',name:'오늘 예정 운동 모두 완료',reward:30,met:todays.every(e=>(rec.completed[e.id]||0)>=e.sets)&&total>0})}
      else {const need=Math.min(10,Math.max(6,Math.ceil(total*0.6))); list.push({id:'q_total_'+need,name:`오늘 총 ${need}세트 완료`,reward:20,met:Object.values(rec.completed).reduce((a,b)=>a+b,0)>=need})}
      return list.slice(0,3);
    }
    const quests=buildDailyQuests(qDate);
    const claimed=state.questsClaimed[qDate]||{};
    const totalQ=quests.length; const claimedCount=quests.reduce((n,q)=>n+(claimed[q.id]?1:0),0); const metCount=quests.reduce((n,q)=>n+(q.met?1:0),0);
    $("#quest-progress").style.width=Math.round(claimedCount/totalQ*100)+"%"; $("#quest-status-label").textContent=`${claimedCount}/${totalQ} 완료 · 달성 ${metCount}/${totalQ}`;
    const listEl=$("#quest-list"); listEl.innerHTML="";
    quests.forEach(q=>{ const li=document.createElement("li"); const left=document.createElement("span"); left.textContent=q.name; li.appendChild(left);
      const right=document.createElement("div"); right.className="row"; right.style.gap=".5rem"; const reward=document.createElement("span"); reward.className="badge"; reward.textContent=`+${q.reward}pt`; right.appendChild(reward);
      if(q.met){ if(claimed[q.id]){ const done=document.createElement("span"); done.className="badge"; done.textContent="지급 완료"; right.appendChild(done);} else { const btn=document.createElement("button"); btn.className="ghost"; btn.textContent="받기"; btn.addEventListener("click",()=>{state.questsClaimed[qDate]=state.questsClaimed[qDate]||{}; if(!state.questsClaimed[qDate][q.id]){ state.questsClaimed[qDate][q.id]=true; state.dailyPoints[qDate]=(state.dailyPoints[qDate]||0)+q.reward; state.points=(state.points||0)+q.reward; save(); renderRank(); }}); right.appendChild(btn);} } else { const p=document.createElement("span"); p.className="muted"; p.textContent="진행중"; right.appendChild(p); }
      li.appendChild(right); listEl.appendChild(li);
    });
  }

  // Settings
  function renderSettings(){
    $("#start-date").value=state.startDate; $("#nth-day").textContent=daysBetween(state.startDate,localDateStr(new Date()))+1;
    $$("#rest-days input[type=checkbox]").forEach(cb=>{cb.checked=state.restDays.includes(Number(cb.value)); cb.onchange=()=>{const v=Number(cb.value); if(cb.checked){if(!state.restDays.includes(v))state.restDays.push(v)}else{state.restDays=state.restDays.filter(x=>x!==v)} save(); renderHome(); renderCalendar();}});
    const list=$("#exercise-list"); list.innerHTML=""; state.exercises.forEach(ex=>{ const item=document.createElement("div"); item.className="row"; const meta=document.createElement("div"); meta.innerHTML=`<div><strong>${ex.name}</strong></div><div class="muted">${ex.type==="count"?"횟수":"시간"} • ${ex.sets}세트 • 주${ex.weeklyInc}증가 • 요일: ${(ex.days||[]).map(d=>WEEKDAYS[d]).join("")}</div>`; const del=document.createElement("button"); del.className="ghost"; del.textContent="삭제"; del.addEventListener("click",()=>{state.exercises=state.exercises.filter(e=>e.id!==ex.id); Object.keys(state.history).forEach(k=>{if(state.history[k]?.completed?.[ex.id]!=null) delete state.history[k].completed[ex.id]}); save(); renderSettings(); renderHome(); renderCalendar();}); item.appendChild(meta); item.appendChild(del); list.appendChild(item); });
  }
  $("#start-date").addEventListener("change",e=>{state.startDate=e.target.value||state.startDate; save(); renderSettings(); renderHome(); renderCalendar();});
  $("#add-exercise").addEventListener("submit",e=>{e.preventDefault(); const fd=new FormData(e.target); const ex={id:crypto.randomUUID(),name:(fd.get("name")||"").trim(),type:fd.get("type"),sets:Number(fd.get("sets"))||1,base:Number(fd.get("base"))||1,weeklyInc:Number(fd.get("weeklyInc"))||0,days:fd.getAll("days").map(Number)}; if(!ex.name){return;} state.exercises.push(ex); save(); e.target.reset(); renderSettings(); renderHome(); renderCalendar();});

  document.addEventListener("click",()=>{}, {once:true});
  function renderHomeInit(){renderHome();renderCalendar();renderRank();renderSettings();} renderHomeInit();
  function routeFromHash(){const hash=(location.hash||"#home").replace("#",""); const ids=["home","calendar","rank","settings"]; ids.forEach(v=>{$("#"+v).setAttribute("aria-hidden",String(v!==hash))});} routeFromHash(); window.addEventListener("hashchange",routeFromHash);
})();