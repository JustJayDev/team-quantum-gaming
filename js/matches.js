import { api, fmtDate } from './api.js';
import { matchPillClass, matchStatusLabel, matchResult, sortMatches } from './matches-helpers.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));

let matches = [];

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  try { matches = await api.matches(); } catch (e) { toast(e.message, true); return; }
  matches = sortMatches(matches);
  render('all');
  document.querySelector('#filters').addEventListener('click', e => {
    const b = e.target.closest('button[data-filter]'); if (!b) return;
    document.querySelectorAll('#filters button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    render(b.dataset.filter);
  });
}

function render(filter) {
  const body = document.querySelector('#matchesBody');
  const list = filter === 'all' ? matches : matches.filter(m => m.match_type === filter);
  if (!list.length) { body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:36px">No matches recorded yet.</td></tr>'; return; }
  body.innerHTML = list.map(m => {
    const status = matchStatusLabel(m.status);
    const statusClass = matchPillClass(m.status);
    const result = matchResult(m);
    const replay = m.replay_url ? `<a href="${esc(m.replay_url)}" target="_blank" rel="noopener" style="color:var(--cyan);font-size:13px">Replay ↗</a>` : '';
    return `
    <tr>
      <td>${fmtDate(m.match_date)}</td>
      <td><span class="pill ${m.match_type === 'scrim' ? 'cyan' : 'grey'}">${esc(m.match_type)}</span></td>
      <td><span class="pill ${statusClass}">${esc(status)}</span></td>
      <td>${esc(m.opponent || '—')}</td>
      <td>${result || '—'}</td>
      <td>${m.kills ?? '—'}</td>
      <td>${m.points ?? '—'}</td>
      <td style="font-size:13px;color:var(--muted)">${Array.isArray(m.roster) ? m.roster.join(', ') : '—'}</td>
      <td style="white-space:normal;color:var(--fg-2);max-width:240px">${esc(m.notes || '')} ${replay}</td>
    </tr>`;
  }).join('');
}

function toast(m, e) { const t = document.querySelector('#toast'); t.textContent = m; t.className = 'show' + (e ? ' err' : ''); setTimeout(() => t.className = '', 2800); }
init();