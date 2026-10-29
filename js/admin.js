// ============================================================
// TQG — admin console (Google Sheets + Cloudflare Worker)
// Writes POST to the Worker at WORKER_URL/write with the admin
// token in the Authorization header. The Worker validates the
// token against its env secret and appends to the sheet.
// No write secret lives in this file or any frontend code.
// ============================================================
import { WORKER_URL, WORKER_PATH } from './config.js';

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
// which rejects bad tokens on write. This UI gate is just cosmetic.
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

async function write(table, payload) {
  const r = await fetch(WORKER_URL + WORKER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ table, payload }),
  });
  if (!r.ok) {
    let msg = r.status;
    try { const j = await r.json(); msg = j.error || msg; } catch {}
    throw new Error(`Write rejected (${r.status}): ${msg}`);
  }
  return r.json();
}
function bind(btnId, handler) {
  $(btnId).addEventListener('click', async () => {
    try { await handler(); } catch (e) { toast(e.message, true); }
  });
}

bind('addPlayer', async () => {
  const ign = $('p_ign').value.trim();
  if (!ign) { toast('IGN is required', true); return; }
  await write('players', {
    ign, display_name: '', role_primary: $('p_role').value, role_secondary: '',
    roster_status: $('p_status').value, join_date: '', avatar_url: '', is_public: true,
  });
  $('p_ign').value = ''; toast('Player added');
});
bind('addAnn', async () => {
  const title = $('a_title').value.trim(), body = $('a_body').value.trim();
  if (!title || !body) { toast('Title and body required', true); return; }
  await write('announcements', { title, body, published_at: new Date().toISOString(), archived: false });
  $('a_title').value = ''; $('a_body').value = ''; toast('Announcement published');
});
bind('addMatch', async () => {
  const date = $('m_date').value, type = $('m_type').value;
  if (!date) { toast('Date required', true); return; }
  await write('matches', {
    match_date: date, match_type: type,
    opponent: $('m_opponent').value.trim() || '',
    placement: $('m_placement').value ? +$('m_placement').value : '',
    kills: $('m_kills').value ? +$('m_kills').value : '',
    roster: '[]', points: '', notes: '', replay_url: '', is_public: true,
  });
  ['m_date','m_opponent','m_placement','m_kills'].forEach(id => $(id).value = '');
  toast('Match recorded');
});
bind('addRec', async () => {
  const ign = $('r_ign').value.trim();
  if (!ign) { toast('IGN required', true); return; }
  await write('recruitment', {
    ign, target_role: $('r_role').value,
    trial_status: 'pending', trial_date: '', decision: 'pending',
    // Private fields are sent to the Worker but must NEVER be part of
    // the published public sheet. The Worker stores them separately.
    eval_notes: $('r_notes').value.trim(), is_public: false,
  });
  $('r_ign').value = ''; $('r_notes').value = ''; toast('Candidate added');
});

// Restore session on load
if (token) setAuthed(true);