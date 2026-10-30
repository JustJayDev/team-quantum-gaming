import { api } from './api.js';
import { profileCard } from './player.js';

function toast(m, e) {
  const t = document.querySelector('#toast');
  t.textContent = m; t.className = 'show' + (e ? ' err' : '');
  setTimeout(() => t.className = '', 2800);
}

async function init() {
  document.querySelector('[data-role="year"]').textContent = new Date().getFullYear();
  let players;
  try { players = await api.players(); } catch (e) { toast(e.message, true); return; }
  const g = document.querySelector('#rosterGrid');
  if (!players.length) {
    g.innerHTML = '<div class="card empty"><div class="big">👥</div><h4>No roster yet</h4><p>Players will appear here when added.</p></div>';
    return;
  }
  g.innerHTML = players.map(profileCard).join('');
}

init();