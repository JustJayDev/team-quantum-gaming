import { api, fmtDate } from './api.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));
async function init(){
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let rows; try { rows = await api.recruitment(); } catch(e){ toast(e.message,true); return; }
  const g = document.querySelector('#recGrid');
  if(!rows.length){ g.innerHTML='<div class="card empty"><div class="big">🎯</div><h4>No open positions</h4><p>Recruitment updates will appear here when published.</p></div>'; return; }
  g.innerHTML = rows.filter(r=>r.is_public).map(r=>`
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h3>${esc(r.ign)}</h3>
        <span class="pill ${r.decision==='accepted'?'lime':'cyan'}">${esc(r.trial_status)}</span>
      </div>
      <p style="color:var(--fg-2);font-size:14px;margin-top:8px">Target role: ${esc(r.target_role)}</p>
      ${r.trial_date?`<p style="color:var(--muted);font-size:13px;margin-top:6px">Trial: ${fmtDate(r.trial_date)}</p>`:''}
    </div>`).join('') || '<div class="card empty"><div class="big">🎯</div><h4>No approved candidates</h4></div>';
}
function toast(m,e){const t=document.querySelector('#toast');t.textContent=m;t.className='show'+(e?' err':'');setTimeout(()=>t.className='',2800);}
init();