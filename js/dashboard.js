// ============================================================
// TQG — dashboard (public)
// Loads published views via anon key, renders empty states.
// Never displays anything not served by a *_public view.
// ============================================================
import { api, overallProgress, phaseProgress, fmtDate } from './api.js';
import { profileCard } from './player.js';

const $ = s => document.querySelector(s);

function setRole(key, val) {
  const el = $(`[data-role="${key}"]`);
  if (el) el.textContent = val ?? '—';
}

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}

async function init() {
  setRole('year', new Date().getFullYear());
  let data;
  try {
    data = await Promise.all([
      api.settings(), api.players(), api.phases(), api.tasks(),
      api.announcements(), api.recruitment(), api.matches(),
    ]);
  } catch (e) {
    setRole('currentPhase', 'Unavailable');
    toast('Could not load data: ' + e.message, true);
    return;
  }
  const [settings, players, phases, tasks, announcements, recruitment, matches] = data;

  // Current phase = first non-completed phase
  const current = phases.find(p => p.status !== 'completed') || phases[0];

  if (current) {
    setRole('currentPhase', current.title);
    setRole('phaseTitle', current.title);
    setRole('phaseDesc', current.description || '—');
    const pct = phaseProgress(tasks, current.id);
    setRole('phasePct', pct + '%');
    setRole('phaseProgress', pct + '%');
    const bar = $('[data-role="phaseBar"]');
    if (bar) bar.style.width = pct + '%';
  } else {
    setRole('currentPhase', 'Planning');
  }

  // Overall progress
  setRole('overallProgress', overallProgress(tasks, phases));

  // Next milestone: earliest incomplete task or phase end date
  const pending = tasks.find(t => !t.done);
  if (pending) {
    const ph = phases.find(p => p.id === pending.phase_id);
    setRole('nextMilestone', fmtDate(ph?.end_date) + ' · ' + pending.title.slice(0,16));
  } else if (current?.end_date) {
    setRole('nextMilestone', fmtDate(current.end_date));
  }

  // Recruitment status
  const activeRec = recruitment.filter(r => r.trial_status === 'in_trial').length;
  setRole('recruitmentStatus', activeRec ? `${activeRec} in trial` : 'Open');

  // Roster
  const rg = $('#rosterGrid');
  if (!players.length) {
    rg.innerHTML = '<div class="card empty"><div class="big">👥</div><h4>No roster yet</h4><p>Players will appear here when added.</p></div>';
  } else {
    rg.innerHTML = players.map(profileCard).join('');
  }

  // Announcements
  const ann = $('#announcements');
  if (!announcements.length) {
    ann.innerHTML = '<div class="card empty"><div class="big">📢</div><h4>No announcements</h4><p>Latest news will show here.</p></div>';
  } else {
    ann.innerHTML = announcements.slice(0, 4).map(a => `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <h3 style="margin:0">${escapeHtml(a.title)}</h3>
          <span class="pill grey">${fmtDate(a.published_at)}</span>
        </div>
        <p style="color:var(--fg-2);font-size:14px;margin-top:8px">${escapeHtml(a.body)}</p>
      </div>`).join('');
  }
}

function pillClass(s) {
  return { active: 'lime', substitute: 'cyan', trial: 'cyan', inactive: 'grey' }[s] || 'grey';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));
}

init();