import { api } from './api.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));
async function init(){
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let matches; try { matches = await api.matches(); } catch(e){ toast(e.message,true); return; }
  const cards = document.querySelector('#statCards');
  if(!matches.length){ cards.innerHTML='<div class="card empty"><div class="big">📊</div><h4>No data</h4><p>Stats appear once matches are recorded.</p></div>'; document.querySelector('#playerStats').innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:36px">No player statistics yet.</td></tr>'; return; }
  const withPlace = matches.filter(m => m.placement != null);
  const withKills = matches.filter(m => m.kills != null);
  const totalKills = withKills.reduce((a,m)=>a+(+m.kills||0),0);
  const avgPlace = withPlace.length ? (withPlace.reduce((a,m)=>a+(+m.placement||0),0)/withPlace.length).toFixed(2) : '—';
  cards.innerHTML = `
    <div class="card stat"><div class="k"><em>${matches.length}</em></div><div class="l">Recorded matches</div></div>
    <div class="card stat"><div class="k"><em>${totalKills}</em></div><div class="l">Total kills (recorded)</div></div>
    <div class="card stat"><div class="k"><em>${avgPlace}</em></div><div class="l">Avg placement</div></div>
    <div class="card stat"><div class="k"><em>${withKills.length ? (totalKills/withKills.length).toFixed(2) : '—'}</em></div><div class="l">Avg kills / match</div></div>`;

  // Player breakdown from roster arrays
  const players = {};
  matches.forEach(m => {
    if(!Array.isArray(m.roster)) return;
    m.roster.forEach(p => {
      if(!players[p]) players[p] = { matches:0, kills:0, placements:[] };
      players[p].matches++;
      if(m.kills != null) players[p].kills += +m.kills||0;
      if(m.placement != null) players[p].placements.push(+m.placement||0);
    });
  });
  const tbody = document.querySelector('#playerStats');
  const rows = Object.entries(players);
  if(!rows.length){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:36px">No player statistics yet.</td></tr>'; return; }
  tbody.innerHTML = rows.sort((a,b)=>b[1].kills-a[1].kills).map(([name,d])=>{
    const avgK = d.matches ? (d.kills/d.matches).toFixed(2): '—';
    const avgP = d.placements.length ? (d.placements.reduce((a,x)=>a+x,0)/d.placements.length).toFixed(2) : '—';
    const best = d.placements.length ? Math.min(...d.placements) : '—';
    return `<tr><td>${esc(name)}</td><td>${d.matches}</td><td>${d.kills}</td><td>${avgK}</td><td>${avgP}</td><td>${best}</td></tr>`;
  }).join('');
}
function toast(m,e){const t=document.querySelector('#toast');t.textContent=m;t.className='show'+(e?' err':'');setTimeout(()=>t.className='',2800);}
init();