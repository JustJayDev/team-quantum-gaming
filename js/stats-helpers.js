// ============================================================
// TQG — pure statistics helpers (testable). No DOM, no IO.
// Every metric derives only from recorded match data. Per-player
// kills/placement are NOT computed because the matches schema has
// no per-player fields (roster is an array of IGNs) — attributing
// a team total to each player would be fabrication. The per-player
// table shows participation count only, which is traceable to the
// roster array. Missing data is never treated as zero.
// ============================================================

// A match counts as completed only when its normalized status is 'completed'.
export function isCompleted(m) {
  return String((m && m.status) || '').trim().toLowerCase() === 'completed';
}

// Matches that count toward performance aggregates (completed only).
export function completedMatches(matches) {
  return (matches || []).filter(isCompleted);
}

export function scheduledMatches(matches) {
  return (matches || []).filter(m => String((m && m.status) || '').trim().toLowerCase() === 'scheduled');
}

export function cancelledMatches(matches) {
  return (matches || []).filter(m => String((m && m.status) || '').trim().toLowerCase() === 'cancelled');
}

// Coerce a numeric cell; returns null when missing/blank/NaN.
export function num(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// Sum of a numeric field over completed matches that define it.
export function sumField(matches, field) {
  return completedMatches(matches)
    .map(m => num(m[field]))
    .filter(x => x !== null)
    .reduce((a, x) => a + x, 0);
}

// Count of completed matches that define a numeric field.
export function countField(matches, field) {
  return completedMatches(matches).filter(m => num(m[field]) !== null).length;
}

// Mean of a numeric field over the completed matches that define it.
// Returns null (not zero) when no completed match defines the field.
export function avgField(matches, field) {
  const n = countField(matches, field);
  if (!n) return null;
  return sumField(matches, field) / n;
}

// Best (minimum) placement over completed matches that define it.
export function bestPlacement(matches) {
  const vals = completedMatches(matches)
    .map(m => num(m.placement))
    .filter(x => x !== null);
  if (!vals.length) return null;
  return Math.min(...vals);
}

// Participation counts: how many completed matches each rostered IGN
// appeared in. Traceable to the roster array. Not a performance stat.
export function participation(matches) {
  const out = {};
  completedMatches(matches).forEach(m => {
    const roster = Array.isArray(m.roster) ? m.roster : [];
    roster.forEach(p => {
      const key = String(p || '').trim();
      if (!key) return;
      out[key] = (out[key] || 0) + 1;
    });
  });
  return out;
}
