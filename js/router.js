// Simple hash router that loads each screen and toggles active tab
window.OWRouter = (function(){
  const cache = {}; // path -> html string
  const routes = {
    "#/home": { path: "/views/home.html", render: (el)=> window.OWHome.render(el) },
    "#/calendar": { path: "/views/calendar.html", render: (el)=> window.OWCalendar.render(el) },
    "#/rank": { path: "/views/rank.html", render: (el)=> window.OWRank.render(el) },
    "#/settings": { path: "/views/settings.html", render: (el)=> window.OWSettings.render(el) },
  };

  async function preload(){
    // Preload all view partials for fast switches and offline use
    for(const key of Object.keys(routes)){
      const p = routes[key].path;
      if(!cache[p]){
        try{
          const res = await fetch(p, {cache:"no-cache"});
          cache[p] = await res.text();
        }catch(e){
          cache[p] = `<section class="view"><div class="card">로드 실패: ${p}</div></section>`;
        }
      }
    }
  }

  function setActiveTab(hash){
    document.querySelectorAll(".tabs .tab").forEach(a=>{
      if(a.getAttribute("href") === hash) a.classList.add("active");
      else a.classList.remove("active");
    });
  }

  async function navigate(){
    let hash = location.hash || "#/home";
    if(!routes[hash]) hash = "#/home";
    setActiveTab(hash);
    const container = document.getElementById("content");
    // Ensure cache available
    if(!cache[routes[hash].path]){
      try{
        const res = await fetch(routes[hash].path, {cache:"no-cache"});
        cache[routes[hash].path] = await res.text();
      }catch(e){
        cache[routes[hash].path] = `<section class="view"><div class="card">로드 실패</div></section>`;
      }
    }
    routes[hash].render(container);
  }

  window.addEventListener("hashchange", navigate);
  window.addEventListener("DOMContentLoaded", async ()=>{
    await preload();
    navigate();
  });

  return { cache };
})();