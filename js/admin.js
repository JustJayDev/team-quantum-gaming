// ============================================================
// TQG — admin console
// Uses Supabase Auth (email/password). All writes carry the
// authenticated session token; RLS enforces them server-side.
// No service-role key, no frontend-only permission checks.
// ============================================================
import { SB_URL, SB_ANON } from './config.js';

const $ = id => document.getElementById(id);
const authGate = $('authGate'), consoleSection = $('console');

let session = { access_token: null };

function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}

function authHeaders(token) {
  return { apikey: SB_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function signIn(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error('Invalid credentials');
  const d = await r.json();
  session.access_token = d.access_token;
  localStorage.setItem('tqg_session', d.access_token);
  showConsole();
}

async function signOut() {
  localStorage.removeItem('tqg_session');
  session.access_token = null;
  authGate.style.display = '';
  consoleSection.style.display = 'none';
}

function showConsole() {
  authGate.style.display = 'none';
  consoleSection.style.display = '';
}

async function write(table, payload) {
  if (!session.access_token) throw new Error('Not authenticated');
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: authHeaders(session.access_token),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = r.status;
    try { const j = await r.json(); msg = j.message || msg; } catch {}
    throw new Error(`Write rejected (${r.status}): ${msg}`);
  }
}

function bind(btnId, handler) {
  $(btnId).addEventListener('click', async () => {
    try { await handler(); } catch (e) { toast(e.message, true); }
  });
}

bind('loginBtn', async () => {
  const err = $('authErr');
  err.style.display = 'none';
  try {
    await signIn($('email').value.trim(), $('password').value);
    toast('Signed in');
  } catch (e) {
    err.textContent = e.message; err.style.display = '';
  }
});

bind('logoutBtn', async () => { await signOut(); toast('Signed out'); });

bind('addPlayer', async () => {
  const ign = $('p_ign').value.trim();
  if (!ign) { toast('IGN is required', true); return; }
  await write('players', {
    ign, role_primary: $('p_role').value, roster_status: $('p_status').value,
  });
  $('p_ign').value = ''; toast('Player added');
});

bind('addAnn', async () => {
  const title = $('a_title').value.trim(), body = $('a_body').value.trim();
  if (!title || !body) { toast('Title and body required', true); return; }
  await write('announcements', { title, body });
  $('a_title').value = ''; $('a_body').value = ''; toast('Announcement published');
});

bind('addMatch', async () => {
  const date = $('m_date').value, type = $('m_type').value;
  if (!date) { toast('Date required', true); return; }
  await write('matches', {
    match_date: date, match_type: type,
    opponent: $('m_opponent').value.trim() || null,
    placement: $('m_placement').value ? +$('m_placement').value : null,
    kills: $('m_kills').value ? +$('m_kills').value : null,
  });
  ['m_date','m_opponent','m_placement','m_kills'].forEach(id => $(id).value = '');
  toast('Match recorded');
});

bind('addRec', async () => {
  const ign = $('r_ign').value.trim();
  if (!ign) { toast('IGN required', true); return; }
  await write('recruitment_candidates', {
    ign, target_role: $('r_role').value, eval_notes: $('r_notes').value.trim() || null,
  });
  $('r_ign').value = ''; $('r_notes').value = ''; toast('Candidate added');
});

// Restore session on load
(async () => {
  const stored = localStorage.getItem('tqg_session');
  if (stored) {
    session.access_token = stored;
    showConsole();
    $('whoami').textContent = 'Session restored';
  }
})();