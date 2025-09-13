// Settings screen module
window.OWSettings = (function(){
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));

  function render(container){
    container.innerHTML = window.OWRouter.cache["/views/settings.html"];
    draw();
  }

  function draw(){
    const { state, save, WEEKDAYS, todayStr } = window.OW;
    $("#start-date").value = state.startDate;
    const nth = ((new Date(todayStr).setHours(0,0,0,0) - new Date(state.startDate).setHours(0,0,0,0)) / 86400000) + 1;
    $("#nth-day").textContent = Math.max(1, Math.floor(nth));

    $$("#rest-days input[type=checkbox]").forEach(cb=>{
      cb.checked = state.restDays.includes(Number(cb.value));
      cb.addEventListener("change", ()=>{
        const v = Number(cb.value);
        if(cb.checked){ if(!state.restDays.includes(v)) state.restDays.push(v); }
        else { state.restDays = state.restDays.filter(x=>x!==v); }
        save();
      });
    });

    const list = $("#exercise-list"); list.innerHTML = "";
    state.exercises.forEach(ex=>{
      const item = document.createElement("div");
      item.className = "row space";
      const meta = document.createElement("div");
      meta.innerHTML = `<strong>${ex.name}</strong> <span class="muted">${ex.type==="count"?"횟수":"시간"} · ${ex.sets}세트 · 주${ex.weeklyInc}증가 · 요일:${(ex.days||[]).map(d=>WEEKDAYS[d]).join("")}</span>`;
      const del = document.createElement("button"); del.className="ghost"; del.textContent="삭제";
      del.addEventListener("click", ()=>{
        state.exercises = state.exercises.filter(e=>e.id!==ex.id);
        Object.keys(state.history).forEach(k=>{ if(state.history[k]?.completed?.[ex.id]!=null) delete state.history[k].completed[ex.id]; });
        save(); draw();
      });
      item.appendChild(meta); item.appendChild(del); list.appendChild(item);
    });

    $("#start-date").addEventListener("change", (e)=>{ state.startDate = e.target.value || state.startDate; save(); draw(); });

    $("#add-exercise").addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const days = fd.getAll("days").map(Number);
      const ex = {
        id: crypto.randomUUID(),
        name: (fd.get("name")||"").trim(),
        type: fd.get("type"),
        sets: Number(fd.get("sets"))||1,
        base: Number(fd.get("base"))||1,
        weeklyInc: Number(fd.get("weeklyInc"))||0,
        days
      };
      if(!ex.name) return;
      state.exercises.push(ex); save(); e.target.reset(); draw();
    });

    $("#export-json").addEventListener("click", ()=>{
      const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "oneul-workout-data.json"; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
    });
    $("#import-json").addEventListener("change", (e)=>{
      const file = e.target.files?.[0]; if(!file) return;
      const fr = new FileReader();
      fr.onload = ()=>{
        try{ const incoming = JSON.parse(fr.result); Object.assign(state, incoming); save(); draw(); }
        catch(err){ alert("불러오기 실패: "+err.message); }
      };
      fr.readAsText(file);
    });
  }

  return { render };
})();