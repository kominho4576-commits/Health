// Home screen module
window.OWHome = (function(){
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));

  function render(container){
    const { state, save, todayStr, exercisesForDate, targetFor, ensureDailyRecord, addPointsForSet, beep } = window.OW;
    container.innerHTML = window.OWRouter.cache["/views/home.html"];
    const wrap = $("#today-exercises");
    const tpl = $("#exercise-card-tpl");

    if(window.OW.isRestDay(todayStr)){
      wrap.innerHTML = `<div class="card"><strong>휴식일</strong>로 설정되어 있습니다. 설정에서 변경할 수 있어요.</div>`;
      $("#sets-total").textContent = "0"; $("#sets-done").textContent = "0"; return;
    }

    window.OW.ensureDailyRecord(todayStr);
    const rec = state.history[todayStr];
    const list = exercisesForDate(todayStr);
    let totalSets = 0, doneSets = 0;

    list.forEach(ex=>{
      const node = tpl.content.firstElementChild.cloneNode(true);
      $(".ex-name", node).textContent = ex.name;
      const tgt = targetFor(ex);
      $(".ex-target", node).textContent = ex.type==="count" ? `${tgt}회 × ${ex.sets}세트` : `${tgt}초 × ${ex.sets}세트`;

      const setsWrap = $(".sets", node);
      const done = rec.completed[ex.id] || 0;
      for(let i=1;i<=ex.sets;i++){
        const b = document.createElement("button"); b.textContent = `세트 ${i}`;
        if(i<=done) b.classList.add("done");
        b.addEventListener("click", ()=>{
          window.OW.beep(60, 660);
          ensureDailyRecord(todayStr);
          const cur = state.history[todayStr].completed[ex.id] || 0;
          if(i <= cur){ state.history[todayStr].completed[ex.id] = i-1; state.points = Math.max(0, state.points-10); }
          else { state.history[todayStr].completed[ex.id] = i; addPointsForSet(); }
          save(); render(container); // re-render
        });
        setsWrap.appendChild(b);
      }

      if(ex.type==="time"){
        const trow = $(".timer-row", node);
        trow.classList.remove("hidden");
        const ts = $(".timer", trow);
        let remain = tgt, timerId = null;
        function label(){ const m=String(Math.floor(remain/60)).padStart(2,"0"); const s=String(remain%60).padStart(2,"0"); ts.textContent=`${m}:${s}`; }
        label();
        trow.addEventListener("click", (e)=>{
          const action = e.target.dataset.action;
          if(action==="start"){
            if(timerId) return;
            timerId = setInterval(()=>{
              remain--; label();
              if(remain<=0){
                clearInterval(timerId); timerId=null; remain=0; label();
                window.OW.beep(220, 1000); setTimeout(()=>window.OW.beep(160, 700), 240);
                const cur = state.history[todayStr].completed[ex.id] || 0;
                if(cur < ex.sets){ state.history[todayStr].completed[ex.id] = cur+1; addPointsForSet(); save(); render(container); }
              }
            },1000);
          } else if(action==="stop"){
            if(timerId){ clearInterval(timerId); timerId=null; window.OW.beep(80,600); }
          }
        });
      }

      totalSets += ex.sets;
      doneSets += done;
      wrap.appendChild(node);
    });

    $("#sets-total").textContent = totalSets;
    $("#sets-done").textContent = doneSets;
    $("#reset-today").addEventListener("click", ()=>{
      if(state.history[window.OW.todayStr]){ delete state.history[window.OW.todayStr]; window.OW.save(); render(container); }
    });
  }

  return { render };
})();