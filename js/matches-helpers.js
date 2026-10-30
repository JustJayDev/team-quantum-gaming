// ============================================================
// TQG — pure match helpers (testable). No DOM, no IO.
// Normalizes a match's status (scheduled/completed/cancelled),
// derives a result string only from recorded data, and gives a
// sort key. Nothing invents results or opponents.
// ============================================================

export function normalizeMatchStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'completed' || s === 'cancelled' || s === 'scheduled') return s;
  return '';
}

// Pill class for a match status.
export function matchPillClass(raw) {
  const s = normalizeMatchStatus(raw);
  return { completed: 'lime', scheduled: 'cyan', cancelled: 'red' }[s] || 'grey';
}

// Human label for a match status.
export function matchStatusLabel(raw) {
  const s = normalizeMatchStatus(raw);
  return { completed: 'Completed', scheduled: 'Scheduled', cancelled: 'Cancelled' }[s] || 'Scheduled';
}

// Derive a result only when a completed match has placement/kills.
// Returns '' when there is nothing to show (honest).
export function matchResult(m) {
  if (normalizeMatchStatus(m.status) !== 'completed') return '';
  const parts = [];
  if (m.placement !== undefined && m.placement !== null && m.placement !== '') parts.push('#' + m.placement);
  if (m.kills !== undefined && m.kills !== null && m.kills !== '') parts.push(m.kills + ' kills');
  return parts.join(' · ');
}

// Sort: scheduled first (upcoming), then cancelled, then completed,
// each by date ascending.
export function matchSortKey(m) {
  const s = normalizeMatchStatus(m.status);
  return s === 'scheduled' ? 0 : s === 'cancelled' ? 1 : s === 'completed' ? 2 : 3;
}

export function sortMatches(matches) {
  return [...matches].sort((a, b) =>
    matchSortKey(a) - matchSortKey(b) ||
    String(a.match_date || '').localeCompare(String(b.match_date || ''))
  );
}