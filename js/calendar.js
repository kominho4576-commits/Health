// Calendar screen module
window.OWCalendar = (function(){
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));

  let viewMonth = new Date();

  function render(container){
    container.innerHTML = window.OWRouter.cache["/views/calendar.html"];
    $("#prev-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()-1); draw(); });
    $("#next-month").addEventListener("click", ()=>{ viewMonth.setMonth(viewMonth.getMonth()+1); draw(); });
    draw();
  }

  function draw(){
    const { WEEKDAYS, isRestDay, exercisesForDate, state } = window.OW;
    $("#month-title").textContent = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth()+1}월`;
    const grid = $("#calendar-grid"); grid.innerHTML = "";
    // weekday headings
    WEEKDAYS.forEach(d=>{ const h=document.createElement("div"); h.className="cell muted"; h.textContent=d; grid.appendChild(h); });
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startIdx = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
    for(let i=0;i<startIdx;i++){ const e=document.createElement("div"); e.className="cell muted"; grid.appendChild(e); }
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d).toISOString().slice(0,10);
      const cell = document.createElement("div"); cell.className="cell"; cell.innerHTML=`<span class="d">${d}</span>`;
      const dayDone = state.history[dateStr] && Object.values(state.history[dateStr].completed).reduce((a,b)=>a+b,0) || 0;
      const todaysExercises = exercisesForDate(dateStr).reduce((a,ex)=>a+ex.sets,0);
      if(isRestDay(dateStr)) cell.classList.add("rest");
      if(dayDone >= todaysExercises && todaysExercises>0) cell.classList.add("done");
      else if(dayDone > 0) cell.classList.add("partial");
      cell.addEventListener("click", ()=> showDayDetail(dateStr));
      grid.appendChild(cell);
    }
    $("#day-detail").textContent = "날짜를 탭하면 상세 기록이 보여요.";
  }

  function showDayDetail(dateStr){
    const { exercisesForDate, state } = window.OW;
    const list = exercisesForDate(dateStr);
    const rec = state.history[dateStr] || {completed:{}};
    const items = list.map(ex=>{
      const c = rec.completed[ex.id]||0;
      return `• ${ex.name} — ${c}/${ex.sets}세트`;
    }).join("<br>");
    document.getElementById("day-detail").innerHTML = `<strong>${dateStr}</strong><br>${items || "기록 없음"}`;
  }

  return { render };
})();