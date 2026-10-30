import { api } from './api.js';
import {
  completedMatches, scheduledMatches, cancelledMatches,
  sumField, avgField, bestPlacement, participation,
} from './stats-helpers.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));

const dash = x => x === null ? '—' : x;

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let matches;
  try { matches = await api.matches(); } catch (e) { toast(e.message, true); return; }
  render(matches);
}

function render(matches) {
  const cards = document.querySelector('#statCards');
  const tbody = document.querySelector('#playerStats');

  const done = completedMatches(matches);
  const sched = scheduledMatches(matches);
  const canc = cancelledMatches(matches);

  // Empty state — honest, no fabricated zeros.
  if (!done.length) {
    cards.innerHTML = '<div class="card empty"><div class="big">📊</div><h4>No completed matches</h4><p>Statistics appear once matches are recorded with a completed status. Upcoming and cancelled matches are not counted.</p></div>';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:36px">No player statistics yet.</td></tr>';
    return;
  }

  // Team aggregates — completed matches only, each metric traced to a field.
  const totalKills = sumField(done, 'kills');
  const avgKills = avgField(done, 'kills');
  const avgPlace = avgField(done, 'placement');
  const best = bestPlacement(done);

  cards.innerHTML = `
    <div class="card stat"><div class="k"><em>${done.length}</em></div><div class="l">Completed matches</div></div>
    <div class="card stat"><div class="k"><em>${totalKills}</em></div><div class="l">Total kills (recorded)</div></div>
    <div class="card stat"><div class="k"><em>${dash(avgKills === null ? null : avgKills.toFixed(2))}</em></div><div class="l">Avg kills / match</div></div>
    <div class="card stat"><div class="k"><em>${dash(avgPlace === null ? null : avgPlace.toFixed(2))}</em></div><div class="l">Average placement</div></div>
    <div class="card stat"><div class="k"><em>${dash(best)}</em></div><div class="l">Best placement</div></div>
    <div class="card stat"><div class="k"><em>${sched.length}</em></div><div class="l">Scheduled (upcoming)</div></div>
    <div class="card stat"><div class="k"><em>${canc.length}</em></div><div class="l">Cancelled</div></div>`;

  // Per-player: participation only. The matches schema has no per-player
  // kills/placement, so ranking players by kills would be fabrication.
  const parts = participation(done);
  const rows = Object.entries(parts).sort((a, b) => b[1] - a[1]);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:36px">No player statistics yet.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(([name, count]) => `
    <tr><td>${esc(name)}</td><td>${count}</td></tr>`).join('');
}

function toast(m, e) { const t = document.querySelector('#toast'); t.textContent = m; t.className = 'show' + (e ? ' err' : ''); setTimeout(() => t.className = '', 2800); }
init();