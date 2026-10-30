// ============================================================
// TQG — pure roadmap helpers (testable).
// No DOM, no IO. Phase status classification and ordering.
// Statuses: planned, in_progress, blocked, completed (plus
// legacy `delayed`/unknown → treated as blocked for display).
// ============================================================

const ORDER = { planned: 0, in_progress: 1, blocked: 2, completed: 3 };

// Map a raw phase status to the canonical display status.
export function normalizeStatus(raw) {
  const s = String(raw || '').trim();
  if (s === 'planned' || s === 'in_progress' || s === 'blocked' || s === 'completed') return s;
  if (s === 'delayed' || s === 'paused' || s === 'stuck') return 'blocked';
  return 'planned';
}

// Pill class for a status.
export function statusPillClass(raw) {
  const s = normalizeStatus(raw);
  return { planned: 'grey', in_progress: 'cyan', blocked: 'red', completed: 'lime' }[s] || 'grey';
}

// Sort order index for a phase.
export function phaseSortKey(phase) {
  return ORDER[normalizeStatus(phase.status)] ?? 0;
}

// Human label for a status.
export function statusLabel(raw) {
  const s = normalizeStatus(raw);
  return { planned: 'Planned', in_progress: 'In progress', blocked: 'Blocked', completed: 'Completed' }[s] || 'Planned';
}

// Whether a phase has no tasks at all (honest note, not "0%").
export function hasNoTasks(phase, tasks) {
  return !tasks.some(t => t.phase_id === phase.id);
}

// Sort phases: by status order, then phase number.
export function sortPhases(phases) {
  return [...phases].sort((a, b) =>
    phaseSortKey(a) - phaseSortKey(b) ||
    Number(a.phase_no || 0) - Number(b.phase_no || 0)
  );
}