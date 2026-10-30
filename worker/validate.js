// ============================================================
// TQG — Worker validation module (shared, unit-testable)
// Enforces tab whitelists, allowed fields, role/status vocab,
// and ID constraints on every write/update/delete. This module
// has no IO and is tested in tests/validate.test.js.
// ============================================================

// Table -> public sheet tab (worker writes only to these).
export const TABLE_TO_TAB = {
  players: 'players',
  announcements: 'announcements',
  matches: 'matches',
  journey: 'journey',
  recruitment: 'recruitment',
};

// Whitelisted columns per public tab. Unknown fields are rejected.
const TAB_COLUMNS = {
  players: ['id','ign','display_name','primary_role','secondary_roles','temporary_roles',
    'roster_status','join_date','previous_roles','achievements','avatar_url','is_public'],
  announcements: ['id','title','body','published_at','archived'],
  matches: ['id','match_date','match_type','status','opponent','roster','placement','kills',
    'points','notes','replay_url','is_public'],
  journey: ['id','date','date_provisional','category','title','description','verified'],
  recruitment: ['id','ign','target_role','trial_status','trial_date','decision','is_public','archived'],
};

// Private tab — never published. Worker writes here only for private fields.
// Includes `archived` so deleting a candidate can archive the private row
// while preserving the private data (it is never exposed publicly).
const PRIVATE_TAB = 'recruitment_private';
const PRIVATE_COLUMNS = ['id','ign','eval_notes','practice_attendance','teamwork_assessment','archived'];

// Vocabulary.
const ROLES = new Set(['IGL','Rusher','Supporter','Sniper','Fragger','Secondary']);
const ROSTER_STATUSES = new Set(['active','substitute','trial','former','inactive']);
const JOURNEY_CATEGORIES = new Set(['formation','roster','recruitment','role','practice','roadmap','scrim','achievement']);
const MATCH_TYPES = new Set(['solo','squad','practice','scrim']);
const MATCH_STATUSES = new Set(['scheduled','completed','cancelled']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isArrayOfStrings(v) {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

// Return { ok:true, table, tab, cols, privateRow? } or { ok:false, error }.
export function validateWrite(table, payload) {
  if (!TABLE_TO_TAB[table]) return { ok: false, error: 'Unknown table' };
  if (!isPlainObject(payload)) return { ok: false, error: 'Payload must be an object' };
  const cols = TAB_COLUMNS[table];

  // Reject unknown fields outright (strict). For recruitment, allow the
  // private columns through too — they are stripped below and routed to
  // the private tab, never the public sheet.
  const allowed = new Set(cols);
  if (table === 'recruitment') PRIVATE_COLUMNS.forEach(c => allowed.add(c));
  const extra = Object.keys(payload).filter(k => !allowed.has(k));
  if (extra.length) return { ok: false, error: `Disallowed field(s): ${extra.join(', ')}` };

  // Table-specific validation.
  if (table === 'players') {
    if (!payload.ign || typeof payload.ign !== 'string') return { ok: false, error: 'IGN required' };
    if (payload.roster_status && !ROSTER_STATUSES.has(payload.roster_status)) {
      return { ok: false, error: `Invalid roster_status: ${payload.roster_status}` };
    }
    if (payload.primary_role && !ROLES.has(payload.primary_role)) {
      return { ok: false, error: `Invalid primary_role: ${payload.primary_role}` };
    }
    for (const f of ['secondary_roles','temporary_roles','previous_roles','achievements']) {
      if (payload[f] !== undefined && !isArrayOfStrings(payload[f])) {
        return { ok: false, error: `${f} must be an array of strings` };
      }
      if (Array.isArray(payload[f]) && !payload[f].every(r => ROLES.has(r))) {
        return { ok: false, error: `${f} contains an invalid role` };
      }
    }
  }
  if (table === 'announcements') {
    if (!payload.title || typeof payload.title !== 'string') return { ok: false, error: 'Title required' };
    if (!payload.body || typeof payload.body !== 'string') return { ok: false, error: 'Body required' };
  }
  if (table === 'matches') {
    if (!payload.match_date || typeof payload.match_date !== 'string') return { ok: false, error: 'match_date required' };
    if (payload.match_type && !MATCH_TYPES.has(payload.match_type)) {
      return { ok: false, error: `Invalid match_type: ${payload.match_type}` };
    }
    if (payload.status && !MATCH_STATUSES.has(payload.status)) {
      return { ok: false, error: `Invalid match status: ${payload.status}` };
    }
    if (payload.roster !== undefined && !isArrayOfStrings(payload.roster)) {
      return { ok: false, error: 'roster must be an array of strings' };
    }
  }
  if (table === 'journey') {
    if (!payload.date || typeof payload.date !== 'string') return { ok: false, error: 'date required' };
    if (!payload.category || !JOURNEY_CATEGORIES.has(payload.category)) {
      return { ok: false, error: `Invalid category: ${payload.category}` };
    }
    if (!payload.title || typeof payload.title !== 'string') return { ok: false, error: 'title required' };
  }
  if (table === 'recruitment') {
    if (!payload.ign || typeof payload.ign !== 'string') return { ok: false, error: 'IGN required' };
  }

  // Private recruitment fields route to the private tab, never the public one.
  if (table === 'recruitment') {
    // The columns that are private-only (not part of the public tab).
    const privateOnly = PRIVATE_COLUMNS.filter(c => !cols.includes(c));
    const privateFields = {};
    for (const c of privateOnly) {
      if (payload[c] !== undefined) privateFields[c] = payload[c];
    }
    // Remove private-only fields from the public row payload.
    const pub = { ...payload };
    for (const c of privateOnly) delete pub[c];
    // Return modified public payload + the private key-value map.
    return { ok: true, table, tab: TABLE_TO_TAB[table], cols, payload: pub, privateFields };
  }
  return { ok: true, table, tab: TABLE_TO_TAB[table], cols, payload, privateFields: {} };
}

export { TAB_COLUMNS, PRIVATE_COLUMNS, PRIVATE_TAB, ROLES };