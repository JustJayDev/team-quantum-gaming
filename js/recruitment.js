import { api, fmtDate } from './api.js';
import { WORKER_URL, WORKER_PATH_APPLY } from './config.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));

const $ = id => document.getElementById(id);

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  await renderOpenPositions();
  bindApplyForm();
}

async function renderOpenPositions() {
  const g = $('recGrid');
  let rows;
  try { rows = await api.recruitment(); } catch (e) {
    // Sheet unconfigured → public list stays at the honest empty state.
    return;
  }
  if (!rows.length) return; // static empty state is already correct
  const approved = rows.filter(r => r.is_public && r.decision === 'accepted');
  if (!approved.length) {
    g.innerHTML = '<div class="card empty"><div class="big">🎯</div><h4>No open positions</h4><p>Recruitment updates will appear here when published.</p></div>';
    return;
  }
  g.innerHTML = approved.map(r => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h3>${esc(r.ign)}</h3>
        <span class="pill lime">Accepted</span>
      </div>
      <p style="color:var(--fg-2);font-size:14px;margin-top:8px">Target role: ${esc(r.target_role)}</p>
      ${r.trial_date ? `<p style="color:var(--muted);font-size:13px;margin-top:6px">Joined: ${fmtDate(r.trial_date)}</p>` : ''}
    </div>`).join('');
}

function setErr(input, msg) {
  const err = input.parentElement.querySelector('.err');
  if (err) { err.textContent = msg; err.style.display = msg ? '' : 'none'; }
}

function bindApplyForm() {
  const form = $('applyForm');
  const submit = $('applySubmit');
  const success = $('applySuccess');
  const backendNote = $('applyBackend');
  if (!form) return;

  // If the worker URL is a placeholder, the backend isn't configured — show
  // an honest note and disable the form rather than pretending it works.
  const backendConfigured = WORKER_URL && !/YOUR_SUBDOMAIN/.test(WORKER_URL) && WORKER_PATH_APPLY;
  if (!backendConfigured) {
    backendNote.hidden = false;
    submit.disabled = true;
    submit.textContent = 'Backend not configured';
    return;
  }

  $('applyAgain').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    form.reset();
    ['a_ign', 'a_role', 'a_contact'].forEach(id => setErr($(id), ''));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ign = $('a_ign').value.trim();
    const role = $('a_role').value;
    const contact = $('a_contact').value.trim();

    let valid = true;
    setErr($('a_ign'), '');
    setErr($('a_role'), '');
    setErr($('a_contact'), '');
    if (!ign) { setErr($('a_ign'), 'IGN is required.'); valid = false; }
    else if (ign.length > 40) { setErr($('a_ign'), 'IGN is too long (max 40).'); valid = false; }
    if (!role) { setErr($('a_role'), 'Select a role.'); valid = false; }
    if (!valid) { $('a_ign').focus(); return; }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      const r = await fetch(WORKER_URL + WORKER_PATH_APPLY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { ign, target_role: role, contact } }),
      });
      if (!r.ok) {
        let msg = 'Submission failed. Please try again.';
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      setErr($('a_ign'), err.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Submit application';
    }
  });
}

init();