// ============================================================
// TQG — shared player-profile helpers
// Renders a player's roles from the multi-role data model:
// primary_role (string|null), secondary_roles / temporary_roles /
// previous_roles / achievements (arrays). Used by the roster page,
// dashboard, and unit tests. Nothing here knows about private
// recruitment data.
// ============================================================

// Normalize a role array (from JSON cell / array) to a safe string array.
export function roleArray(v) {
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string' && x.trim());
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.filter(x => typeof x === 'string' && x.trim());
    } catch { /* fall through */ }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// "Current roles" — primary first, then secondary, then temporary.
// Returns a display string, or '' when nothing is recorded.
export function currentRolesLabel(p) {
  const parts = [];
  if (p.primary_role) parts.push(p.primary_role);
  parts.push(...roleArray(p.secondary_roles));
  parts.push(...roleArray(p.temporary_roles));
  return parts.filter((v, i, a) => a.indexOf(v) === i).join(' · ');
}

// "Previous roles" — distinct list, or '' when none recorded.
export function previousRolesLabel(p) {
  const arr = roleArray(p.previous_roles);
  return arr.filter((v, i, a) => a.indexOf(v) === i).join(' · ');
}

// Whether the player has any recorded role (current or previous).
export function hasRoles(p) {
  return Boolean(p.primary_role || roleArray(p.secondary_roles).length || roleArray(p.temporary_roles).length || roleArray(p.previous_roles).length);
}

// Achievements — array, safe.
export function achievementsList(p) {
  return roleArray(p.achievements);
}

// Build a profile card for a player. Uses the established card markup.
// Unknown fields are simply omitted; "unrecorded" is never invented.
export function profileCard(p, esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'"',"'":'&#39;' }[c]))) {
  const statusClass = ({ active:'lime', substitute:'cyan', trial:'cyan', inactive:'grey', former:'grey' }[p.roster_status] || 'grey');
  const current = currentRolesLabel(p);
  const prev = previousRolesLabel(p);
  const achv = achievementsList(p);
  const joined = p.join_date || '';
  return `
    <div class="card player-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h3>${esc(p.ign)}</h3>
        <span class="pill ${statusClass}">${esc(p.roster_status)}</span>
      </div>
      ${p.display_name ? `<p class="p-display">${esc(p.display_name)}</p>` : ''}
      ${current ? `<p class="p-roles"><span class="lbl">Current</span> ${esc(current)}</p>` : ''}
      ${prev ? `<p class="p-roles"><span class="lbl">Previous</span> ${esc(prev)}</p>` : ''}
      ${joined ? `<p class="p-joined">Joined ${esc(joined)}</p>` : ''}
      ${achv.length ? `<div class="p-achv"><span class="lbl">Achievements</span><ul>${achv.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    </div>`;
}
