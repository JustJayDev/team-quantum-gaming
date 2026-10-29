import { api, fmtDate } from './api.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));
const pillClass = s => ({ active:'lime', substitute:'cyan', trial:'cyan', inactive:'grey' }[s] || 'grey');
async function init(){
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let players; try { players = await api.players(); } catch(e){ toast(e.message,true); return; }
  const g = document.querySelector('#rosterGrid');
  if(!players.length){ g.innerHTML='<div class="card empty"><div class="big">👥</div><h4>No roster yet</h4><p>Players will appear here when added.</p></div>'; return; }
  g.innerHTML = players.map(p=>`
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h3>${esc(p.ign)}</h3>
        <span class="pill ${pillClass(p.roster_status)}">${esc(p.roster_status)}</span>
      </div>
      ${p.display_name?`<p style="color:var(--muted);font-size:13px;margin-top:2px">${esc(p.display_name)}</p>`:''}
      <p style="color:var(--fg-2);font-size:14px;margin-top:10px">${esc(p.role_primary)}${p.role_secondary?' / '+esc(p.role_secondary):''}</p>
      ${p.join_date?`<p style="color:var(--muted);font-size:13px;margin-top:8px">Joined ${fmtDate(p.join_date)}</p>`:''}
    </div>`).join('');
}
function toast(m,e){const t=document.querySelector('#toast');t.textContent=m;t.className='show'+(e?' err':'');setTimeout(()=>t.className='',2800);}
init();