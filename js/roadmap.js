import { api, phaseProgress, fmtDate } from './api.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));
const statusPill = s => ({ planned:'grey', in_progress:'cyan', completed:'lime', delayed:'red' }[s] || 'grey');
const phaseOrder = { planned:0, in_progress:1, completed:2, delayed:3 };

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let data;
  try { data = await Promise.all([api.phases(), api.tasks(), api.settings()]); }
  catch (e) { toast('Could not load: ' + e.message, true); return; }
  const [phases, tasks, settings] = data;
  const start = settings[0]?.roadmap_start_date;

  const list = document.querySelector('#roadmapList');
  if (!phases.length) { list.innerHTML = '<div class="card empty"><div class="big">🗺️</div><h4>No phases yet</h4><p>Roadmap phases will appear here.</p></div>'; return; }

  const sorted = [...phases].sort((a,b) => phaseOrder[a.status] - phaseOrder[b.status] || a.phase_no - b.phase_no);
  list.innerHTML = sorted.map(p => {
    const pct = phaseProgress(tasks, p.id);
    const phaseTasks = tasks.filter(t => t.phase_id === p.id);
    return `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="font-size:18px">${esc(p.title)}</h3>
          <p style="color:var(--muted);font-size:13px;margin-top:4px">Phase ${p.phase_no} · ${esc(p.status)}</p>
        </div>
        <span class="pill ${statusPill(p.status)}">${esc(p.status)}</span>
      </div>
      ${p.description ? `<p style="color:var(--fg-2);font-size:14px;margin-top:10px">${esc(p.description)}</p>` : ''}
      <div style="margin-top:16px">
        <div class="progress-label"><span>Progress</span><b>${pct}%</b></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:13px;color:var(--muted)">
        <span>Start: ${fmtDate(p.start_date)}</span>
        <span>End: ${fmtDate(p.end_date)}</span>
        ${p.completion_date ? `<span>Completed: ${fmtDate(p.completion_date)}</span>` : ''}
      </div>
      ${phaseTasks.length ? `
      <ul style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px;display:grid;gap:8px">
        ${phaseTasks.map(t => `<li style="display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--fg-2)"><span style="color:${t.done ? 'var(--lime)' : 'var(--muted)'};flex:none">${t.done ? '✓' : '○'}</span>${esc(t.title)}</li>`).join('')}
      </ul>` : ''}
    </div>`;
  }).join('');
}

function toast(msg, err) {
  const t = document.querySelector('#toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}
init();