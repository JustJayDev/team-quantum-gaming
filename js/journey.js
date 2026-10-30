import { api, fmtDate } from './api.js';
import { sortJourney, journeyStatus, journeyStatusLabel } from './journey-helpers.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]));

function toast(m, e) {
  const t = document.querySelector('#toast');
  t.textContent = m; t.className = 'show' + (e ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}

// Category → label + accent. Only generic labels; no invented detail.
const CAT = {
  formation: 'Formation', roster: 'Roster', recruitment: 'Recruitment', role: 'Roster change',
  practice: 'Practice', roadmap: 'Roadmap', scrim: 'Scrim', achievement: 'Achievement',
};

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let items;
  try { items = await api.journey(); } catch (e) { toast(e.message, true); return; }
  const list = document.querySelector('#journeyList');
  if (!items.length) {
    list.innerHTML = '<div class="card empty"><div class="big">🕰️</div><h4>No milestones yet</h4><p>The journey will appear here as it is recorded.</p></div>';
    return;
  }
  // Deterministic order: by date ascending; same-date items keep stable order.
  const sorted = sortJourney(items);
  list.innerHTML = sorted.map(item => {
    const cat = CAT[item.category] || 'Milestone';
    const provisional = item.date_provisional;
    const verified = item.verified;
    const status = journeyStatus(item);
    const statusLabel = journeyStatusLabel(status);
    // A milestone is "confirmed" only when verified is true; otherwise it is
    // provisional/planned and clearly labelled as such.
    const badge = `<span class="pill ${status === 'confirmed' ? 'lime' : status === 'provisional' ? 'cyan' : 'grey'} tl-badge">${statusLabel}</span>`;
    const dateEl = item.date ? `<span class="tl-date">${fmtDate(item.date)}${provisional ? ' (provisional)' : ''}</span>` : '<span class="tl-date">Date not recorded</span>';
    return `
      <article class="timeline-item">
        <div class="tl-rail"><span class="tl-dot"></span></div>
        <div class="tl-body">
          <div class="tl-head">
            <span class="tl-cat">${esc(cat)}</span>
            ${badge}
          </div>
          <h3>${esc(item.title)}</h3>
          ${item.description ? `<p class="tl-desc">${esc(item.description)}</p>` : ''}
          <div class="tl-meta">${dateEl}</div>
        </div>
      </article>`;
  }).join('');
}

init();