// ============================================================
// TQG — pure helpers for the Journey timeline (testable).
// No DOM, no IO. Handles deterministic ordering and the
// confirmed / provisional / planned status label for a milestone.
// ============================================================

// Deterministic chronological order: by date ascending; for items with
// the same (or missing) date, fall back to id for stable order.
export function sortJourney(items) {
  return [...items].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  );
}

// A milestone's status label.
//  - verified === true  → confirmed
//  - date_provisional   → provisional date
//  - otherwise           → planned
export function journeyStatus(item) {
  if (item && item.verified) return 'confirmed';
  if (item && item.date_provisional) return 'provisional';
  return 'planned';
}

// Human label for the status.
export function journeyStatusLabel(status) {
  return { confirmed: 'Confirmed', provisional: 'Provisional date', planned: 'Planned' }[status] || 'Planned';
}
