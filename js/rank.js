// Rank screen module
window.OWRank = (function(){
  function render(container){
    container.innerHTML = window.OWRouter.cache["/views/rank.html"];
    draw();
  }
  function draw(){
    const { state, currentRank } = window.OW;
    const {cur, next, toNext, prog} = currentRank(state.points);
    document.getElementById("rank-name").textContent = cur.name;
    document.getElementById("points").textContent = state.points;
    document.getElementById("to-next").textContent = toNext;
    document.getElementById("rank-progress").style.width = prog + "%";
    document.getElementById("next-rank-label").textContent = (next.name===cur.name) ? "최고 랭크" : `${next.name}까지`;
  }
  return { render };
})();