// ============================================================
// TQG — admin console (Google Sheets + Cloudflare Worker)
// Writes/updates/deletes go through the Worker, which validates
// the admin token on every request and whitelists fields.
// No write secret lives in this file or any frontend code.
// ============================================================
import { WORKER_URL, WORKER_PATH_WRITE, WORKER_PATH_UPDATE, WORKER_PATH_DELETE } from './config.js';
import { api } from './api.js';

const $ = id => document.getElementById(id);
const authGate = $('authGate'), consoleSection = $('console');
let token = localStorage.getItem('tqg_admin_token') || '';

function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}
function setAuthed(on) {
  if (on) {
    authGate.style.display = 'none';
    consoleSection.style.display = '';
    $('whoami').textContent = 'Session active';
  } else {
    authGate.style.display = '';
    consoleSection.style.display = 'none';
  }
}

// --- Auth: capture the admin token. The real gate is the Worker,
// which rejects bad tokens on every request. This UI gate is cosmetic.
$('loginBtn').addEventListener('click', () => {
  const t = $('tokenInput').value.trim();
  if (!t) { $('authErr').textContent = 'Token required'; $('authErr').style.display = ''; return; }
  token = t;
  localStorage.setItem('tqg_admin_token', t);
  $('tokenInput').value = '';
  setAuthed(true);
  toast('Signed in');
});
$('logoutBtn').addEventListener('click', () => {
  token = '';
  localStorage.removeItem('tqg_admin_token');
  setAuthed(false);
  toast('Signed out');
});

async function call(path, table, payload) {
  const r = await fetch(WORKER_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ table, payload }),
  });
  if (!r.ok) {
    let msg = r.status;
    try { const j = await r.json(); msg = j.error || msg; } catch {}
    throw new Error(`${path} rejected (${r.status}): ${msg}`);
  }
  return r.json();
}
function bind(btnId, handler) {
  const el = $(btnId);
  if (!el) { console.warn('admin: missing element #' + btnId); return; }
  el.addEventListener('click', async () => {
    try { await handler(); } catch (e) { toast(e.message, true); }
  });
}

// --- Roster ---
function csvList(id) {
  return $(id).value.split(',').map(s => s.trim()).filter(Boolean);
}
bind('addPlayer', async () => {
  const ign = $('p_ign').value.trim();
  if (!ign) { toast('IGN is required', true); return; }
  await call(WORKER_PATH_WRITE, 'players', {
    ign,
    display_name: $('p_display').value.trim() || '',
    primary_role: $('p_role').value || null,
    secondary_roles: csvList('p_secondary'),
    temporary_roles: csvList('p_temp'),
    roster_status: $('p_status').value,
    join_date: $('p_join').value || '',
    previous_roles: csvList('p_prev'),
    achievements: csvList('p_achv'),
    avatar_url: '',
    is_public: true,
  });
  ['p_ign','p_display','p_role','p_secondary','p_temp','p_prev','p_achv','p_join'].forEach(id => $(id).value = '');
  toast('Player added');
});

// --- Announcements ---
bind('addAnn', async () => {
  const title = $('a_title').value.trim(), body = $('a_body').value.trim();
  if (!title || !body) { toast('Title and body required', true); return; }
  await call(WORKER_PATH_WRITE, 'announcements', { title, body, published_at: new Date().toISOString(), archived: false });
  $('a_title').value = ''; $('a_body').value = ''; toast('Announcement published');
});

// --- Matches ---
bind('addMatch', async () => {
  const date = $('m_date').value, type = $('m_type').value;
  if (!date) { toast('Date required', true); return; }
  await call(WORKER_PATH_WRITE, 'matches', {
    match_date: date, match_type: type, status: $('m_status').value,
    opponent: $('m_opponent').value.trim() || '',
    placement: $('m_placement').value ? +$('m_placement').value : '',
    kills: $('m_kills').value ? +$('m_kills').value : '',
    roster: [],
    points: '', notes: '', replay_url: '', is_public: true,
  });
  ['m_date','m_opponent','m_placement','m_kills'].forEach(id => $(id).value = '');
  toast('Match recorded');
});

// --- Recruitment (private fields routed by the Worker) ---
bind('addRec', async () => {
  const ign = $('r_ign').value.trim();
  if (!ign) { toast('IGN required', true); return; }
  await call(WORKER_PATH_WRITE, 'recruitment', {
    ign, target_role: $('r_role').value,
    trial_status: 'pending', trial_date: '', decision: 'pending',
    // Private fields: never published. The Worker writes them only to
    // the private tab (recruitment_private).
    eval_notes: $('r_notes').value.trim(),
    is_public: false,
  });
  $('r_ign').value = ''; $('r_notes').value = ''; toast('Candidate added');
});

// --- Recruitment approve (set decision=approved + trial_status=active, expose publicly) ---
bind('approveRec', async () => {
  const id = $('r_approve').value.trim();
  if (!id) { toast('Candidate id required', true); return; }
  // Resolve the candidate row from the public sheet so we can pass the
  // full validated payload back through the Worker's /update route.
  let cand;
  try { cand = (await api.recruitment()).find(r => r.id === id); }
  catch { toast('Could not read sheet for candidate', true); return; }
  if (!cand) { toast('Candidate not found in sheet', true); return; }
  await call(WORKER_PATH_UPDATE, 'recruitment', {
    id,
    ign: cand.ign,
    target_role: cand.target_role || '',
    trial_status: 'active',
    decision: 'approved',
    is_public: true,
  });
  $('r_approve').value = ''; toast('Candidate approved');
});

// --- Journey ---
bind('addJourney', async () => {
  const date = $('j_date').value, title = $('j_title').value.trim();
  if (!date || !title) { toast('Date and title required', true); return; }
  await call(WORKER_PATH_WRITE, 'journey', {
    date,
    category: $('j_cat').value,
    title,
    description: $('j_desc').value.trim(),
    verified: $('j_verified').value === 'true',
  });
  ['j_date','j_title','j_desc'].forEach(id => $(id).value = '');
  toast('Milestone added');
});

// --- Phases ---
bind('addPhase', async () => {
  const title = $('ph_title').value.trim();
  if (!title) { toast('Phase title required', true); return; }
  await call(WORKER_PATH_WRITE, 'phases', {
    phase_no: $('ph_no').value ? +$('ph_no').value : '',
    title,
    description: $('ph_desc').value.trim(),
    status: $('ph_status').value,
    start_date: '', end_date: '', completion_date: '',
  });
  ['ph_no','ph_title','ph_desc'].forEach(id => $(id).value = '');
  toast('Phase added');
});

// --- Tasks ---
bind('addTask', async () => {
  const phaseId = $('t_phase').value.trim(), title = $('t_title').value.trim();
  if (!phaseId || !title) { toast('Phase id and title required', true); return; }
  await call(WORKER_PATH_WRITE, 'tasks', {
    phase_id: phaseId, title, done: $('t_done').value === 'true', completed_at: '',
  });
  $('t_phase').value = ''; $('t_title').value = ''; toast('Task added');
});

// --- Soft-delete examples (roster/announcements) ---
bind('deletePlayer', async () => {
  const id = $('del_player_id').value.trim();
  if (!id) { toast('Player id required', true); return; }
  await call(WORKER_PATH_DELETE, 'players', { id });
  $('del_player_id').value = ''; toast('Player archived');
});
bind('deleteAnn', async () => {
  const id = $('del_ann_id').value.trim();
  if (!id) { toast('Announcement id required', true); return; }
  await call(WORKER_PATH_DELETE, 'announcements', { id });
  $('del_ann_id').value = ''; toast('Announcement archived');
});
bind('deleteMatch', async () => {
  const id = $('del_match_id').value.trim();
  if (!id) { toast('Match id required', true); return; }
  await call(WORKER_PATH_DELETE, 'matches', { id });
  $('del_match_id').value = ''; toast('Match archived');
});
bind('deletePhase', async () => {
  const id = $('del_phase_id').value.trim();
  if (!id) { toast('Phase id required', true); return; }
  await call(WORKER_PATH_DELETE, 'phases', { id });
  $('del_phase_id').value = ''; toast('Phase archived');
});
bind('deleteTask', async () => {
  const id = $('del_task_id').value.trim();
  if (!id) { toast('Task id required', true); return; }
  await call(WORKER_PATH_DELETE, 'tasks', { id });
  $('del_task_id').value = ''; toast('Task archived');
});
bind('deleteJourney', async () => {
  const id = $('del_journey_id').value.trim();
  if (!id) { toast('Journey id required', true); return; }
  await call(WORKER_PATH_DELETE, 'journey', { id });
  $('del_journey_id').value = ''; toast('Milestone archived');
});

// Restore session on load
if (token) setAuthed(true);