// ============================================================
// TQG — data layer (Google Sheets published CSV)
// Public reads fetch each tab's CSV from the published sheet
// (gviz/tq endpoint, no auth). Column headers are row 1.
// Writes go through the Cloudflare Worker (see js/admin.js).
// ============================================================
import { SHEET_ID, SHEET_TABS } from './config.js';

function sheetUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

// Parse CSV into array of objects; first row is headers.
// Handles quoted fields with commas and escaped quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(x => x.trim() !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
  }
  row.push(cur);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

async function get(tab) {
  const r = await fetch(sheetUrl(tab));
  if (!r.ok) throw new Error(`Sheet ${tab} → ${r.status}`);
  return parseCSV(await r.text());
}

// Coerce boolean "true"/"1" to boolean.
function toBool(v) {
  return v === true || v === 'true' || v === '1';
}
// Parse a JSON-array cell safely. Returns [] on empty or malformed.
function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
// A record is "active" if it has no archived column or archived is not truthy.
// This keeps pre-archival records working.
function isPublic(row) {
  return !('archived' in row) || !toBool(row.archived);
}

// Public reads — each returns an array of plain objects. Soft-deleted
// (archived) records are excluded consistently. Records without an
// archived column are always included.
export const api = {
  settings: () => get(SHEET_TABS.settings),
  players: () => get(SHEET_TABS.players).then(rows => rows.filter(isPublic).map(p => ({
    ...p,
    primary_role: p.primary_role || null,
    secondary_roles: toArray(p.secondary_roles),
    temporary_roles: toArray(p.temporary_roles),
    previous_roles: toArray(p.previous_roles),
    achievements: toArray(p.achievements),
  }))),
  phases: () => get(SHEET_TABS.phases).then(rows => rows.filter(isPublic)),
  tasks: () => get(SHEET_TABS.tasks).then(rows => rows.filter(isPublic).map(t => ({ ...t, done: toBool(t.done) }))),
  practice: () => get(SHEET_TABS.practice).then(rows => rows.filter(isPublic)),
  journey: () => get(SHEET_TABS.journey).then(rows => rows.filter(isPublic).map(j => ({
    ...j,
    date_provisional: toBool(j.date_provisional),
    verified: toBool(j.verified),
  }))),
  matches: () => get(SHEET_TABS.matches).then(rows => rows.filter(isPublic).map(m => ({
    ...m,
    roster: toArray(m.roster),
  }))),
  announcements: () => get(SHEET_TABS.announcements).then(rows => rows.filter(isPublic)),
  recruitment: () => get(SHEET_TABS.recruitment).then(rows => rows.filter(isPublic)),
};

// Progress calc: completed tasks / total tasks
export function phaseProgress(tasks, phaseId) {
  const list = tasks.filter(t => t.phase_id === phaseId);
  if (!list.length) return 0;
  const undone = list.filter(t => t.done).length;
  return Math.round((undone / list.length) * 100);
}
export function overallProgress(tasks, phases) {
  if (!phases.length) return 0;
  const data = phases.reduce((a, p) => a + phaseProgress(tasks, p.id), 0);
  return Math.round(data / phases.length);
}
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}