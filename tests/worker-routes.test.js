// ============================================================
// TQG — integration tests for the Cloudflare Worker routes
// (/write, /update, /delete). Mocks the global fetch and the
// Google Sheets API so the whole request path is exercised:
// auth → validate → readTab → append/update → response.
// Usage: node tests/worker-routes.test.js
// ============================================================
import worker from '../worker/index.js';

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

// ---- Fake storage for the Sheets API ----
const sheets = {
  // headers must match TAB_COLUMNS.players (12) + archived
  players: [['id','ign','display_name','primary_role','secondary_roles','temporary_roles','roster_status','join_date','previous_roles','achievements','avatar_url','is_public','archived']],
  announcements: [['id','title','body','published_at','archived']],
  recruitment: [['id','ign','target_role','trial_status','trial_date','decision','is_public','archived']],
  recruitment_private: [['id','ign','eval_notes','practice_attendance','teamwork_assessment','archived']],
  phases: [['id','phase_no','title','description','status','start_date','end_date','completion_date','archived']],
  tasks: [['id','phase_id','title','done','completed_at','archived']],
  matches: [['id','match_date','match_type','status','opponent','roster','placement','kills','points','notes','replay_url','is_public','archived']],
  journey: [['id','date','date_provisional','category','title','description','verified','archived']],
};
let seq = 100;

// Extract the sheet tab from a values API URL: ".../values/players!A1:Z1000"
// or ".../values/players!A1:append?..."  The tab is the part before '!'.
function tabFromUrl(u) {
  const after = u.split('/values/')[1] || '';
  return after.split('!')[0];
}

// Mock global fetch: OAuth token + Sheets API.
// `sheetsFail` — when set, the next Google Sheets call fails with the given
// status. Used to exercise the worker's 502 error paths.
let sheetsFail = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('oauth2.googleapis.com/token')) {
    return { ok: true, status: 200, json: async () => ({ access_token: 'FAKE_TOKEN' }) };
  }
  if (u.includes('sheets.googleapis.com/v4/spreadsheets')) {
    if (sheetsFail) {
      const s = sheetsFail; sheetsFail = null;
      return { ok: false, status: s, json: async () => ({ error: 'sheets down' }) };
    }
    const tab = tabFromUrl(u);
    if (opts.method === 'POST' && /append/.test(u)) {
      const body = JSON.parse(opts.body);
      const row = body.values[0];
      sheets[tab].push(row);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      const nr = /!A(\d+):/.exec(u);
      const rowIdx = Number(nr[1]);
      sheets[tab][rowIdx - 1] = body.values[0];
      return { ok: true, status: 200, json: async () => ({}) };
    }
    // GET read
    return {
      ok: true, status: 200,
      json: async () => ({ values: sheets[tab] }),
    };
  }
  return { ok: false, status: 404, json: async () => ({ error: 'not mocked' }) };
};

const ENV = {
  ADMIN_TOKEN: 'test-token',
  SPREADSHEET_ID: 'fake-sheet',
  SERVICE_ACCOUNT: {
    client_email: 'fake@service-account.test',
    private_key: '-----BEGIN PRIVATE KEY-----\nZmFrZS1wcml2YXRlLWtleQ==\n-----END PRIVATE KEY-----',
  },
};

// Stub Web Crypto signing so the worker can build a fake JWT without a real key.
const realImportKey = crypto.subtle.importKey;
const realSign = crypto.subtle.sign;
crypto.subtle.importKey = async () => ({ fakeKey: true });
crypto.subtle.sign = async () => new Uint8Array([1, 2, 3, 4]);

function makeReq(path, token, body) {
  return new Request('https://tqg-admin.test.workers.dev' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(body),
  });
}

// Helper: build a request with a specific client IP (for /apply rate-limit tests).
function makeApplyReq(path, ips, payload) {
  return new Request('https://tqg-admin.test.workers.dev' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ips,
    },
    body: JSON.stringify(payload),
  });
}

async function run(path, token, body) {
  const res = await worker.fetch(makeReq(path, token, body), ENV);
  let j = null;
  try { j = await res.json(); } catch {}
  return { status: res.status, json: j };
}

console.log('auth:');
{
  const r = await run('/write', 'wrong', { table: 'players', payload: { ign: 'X' } });
  ok('bad token → 401', r.status === 401);
}
{
  const r = await run('/write', '', { table: 'players', payload: { ign: 'X' } });
  ok('missing token → 401', r.status === 401);
}

console.log('/write:');
{
  const r = await run('/write', 'test-token', { table: 'players', payload: { ign: 'TQG.KAIZEN07', primary_role: null, secondary_roles: ['Sniper'], roster_status: 'active', is_public: true } });
  ok('valid player write → 200', r.status === 200 && r.json.ok === true);
  const id = r.json.id;
  ok('id returned', typeof id === 'string' && id.length > 0);
  const row = sheets.players[1];
  ok('appended to players tab', row && row[1] === 'TQG.KAIZEN07');
  ok('primary_role null stored as empty', row[3] === '' || row[3] === undefined);
  ok('secondary_roles stored as JSON array', row[4] === '["Sniper"]');
  ok('archived defaults empty (pre-filter)', row[12] === '' || row[12] === undefined);
}
{
  const r = await run('/write', 'test-token', { table: 'players', payload: { ign: 'X', admin_secret: 'leak' } });
  ok('disallowed field → 400', r.status === 400 && r.json.error.includes('Disallowed'));
}
{
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'ASTROO !!!', target_role: 'Supporter', trial_status: 'trial', eval_notes: 'secret', practice_attendance: '3/3', is_public: false } });
  ok('recruitment write → 200', r.status === 200 && r.json.ok === true);
  const id = r.json.id;
  const pubRow = sheets.recruitment.find(rr => rr[0] === id);
  ok('public recruitment row has no private fields', pubRow && !pubRow.includes('secret'));
  const privRow = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('private fields routed to private tab', privRow && privRow[2] === 'secret' && privRow[3] === '3/3');
}

console.log('/update:');
{
  const r = await run('/write', 'test-token', { table: 'players', payload: { ign: 'TQG.SCOP07', primary_role: 'Sniper', roster_status: 'active', is_public: true } });
  const id = r.json.id;
  const r2 = await run('/update', 'test-token', { table: 'players', payload: { id, ign: 'TQG.SCOP07', primary_role: 'Fragger' } });
  ok('valid update → 200', r2.status === 200 && r2.json.ok === true);
  const row = sheets.players.find(rr => rr[0] === id);
  ok('primary_role updated', row[3] === 'Fragger');
  ok('ign preserved', row[1] === 'TQG.SCOP07');
  ok('other fields preserved', row[1] === 'TQG.SCOP07');
}
{
  const r = await run('/update', 'test-token', { table: 'players', payload: { id: 'nope', ign: 'X' } });
  ok('unknown id → 400', r.status === 400 && r.json.error.includes('not found'));
}
{
  const r = await run('/update', 'test-token', { table: 'players', payload: { ign: 'X' } });
  ok('update without id → 400', r.status === 400 && r.json.error.includes('id required'));
}

console.log('/delete:');
{
  const r = await run('/write', 'test-token', { table: 'announcements', payload: { title: 'Hi', body: 'Hello', published_at: '2026-10-01' } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'announcements', payload: { id } });
  ok('valid delete → 200', r2.status === 200 && r2.json.ok === true);
  const row = sheets.announcements.find(rr => rr[0] === id);
  ok('archived flag set to true', row && row[4] === 'true');
}
{
  // Valid player delete — soft-archives the player row.
  const r = await run('/write', 'test-token', { table: 'players', payload: { ign: 'DELP1', roster_status: 'active', is_public: true } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'players', payload: { id } });
  ok('valid player delete → 200', r2.status === 200 && r2.json.ok === true);
  const row = sheets.players.find(rr => rr[0] === id);
  ok('player archived flag set to true', row && row[12] === 'true');
}
{
  const r = await run('/delete', 'test-token', { table: 'players', payload: { id: 'nope' } });
  ok('unknown id → 400', r.status === 400 && r.json.error.includes('not found'));
}

console.log('/update private-field routing (append + combined):');
{
  // Write a recruitment candidate with NO private fields initially.
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'TQG.ZYOTO', target_role: 'Rusher', trial_status: 'pending', is_public: false } });
  const id = r.json.id;
  ok('recruitment write (no private) → 200', r.status === 200 && r.json.ok === true);
  const privBefore = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('no private row exists yet', !privBefore);
  // Update with private fields — must APPEND a private row.
  const r2 = await run('/update', 'test-token', { table: 'recruitment', payload: { id, ign: 'TQG.ZYOTO', target_role: 'Rusher', eval_notes: 'strong aim', practice_attendance: '4/5', teamwork_assessment: 'good' } });
  ok('update appends private row → 200', r2.status === 200 && r2.json.ok === true);
  const privAfter = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('private row appended with values', privAfter && privAfter[2] === 'strong aim' && privAfter[3] === '4/5' && privAfter[4] === 'good');
  ok('private row archived empty on create', privAfter && (privAfter[5] === '' || privAfter[5] === undefined));
}
{
  // Update BOTH public and private recruitment fields in one request.
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'TQG.SCOP07', target_role: 'Sniper', trial_status: 'active', eval_notes: 'old notes', is_public: true } });
  const id = r.json.id;
  const r2 = await run('/update', 'test-token', { table: 'recruitment', payload: { id, ign: 'TQG.SCOP07', target_role: 'Sniper', decision: 'approved', eval_notes: 'updated notes' } });
  ok('combined update → 200', r2.status === 200 && r2.json.ok === true);
  const pubRow = sheets.recruitment.find(rr => rr[0] === id);
  ok('public decision updated', pubRow && pubRow[5] === 'approved');
  const privRow = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('private eval_notes updated', privRow && privRow[2] === 'updated notes');
}
{
  // Update private field on a candidate whose private row exists (update, not append).
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'R1', target_role: 'Supporter', trial_status: 'pending', eval_notes: 'first', practice_attendance: '1/3', is_public: true } });
  const id = r.json.id;
  const r2 = await run('/update', 'test-token', { table: 'recruitment', payload: { id, ign: 'R1', target_role: 'Supporter', eval_notes: 'second' } });
  ok('update existing private row → 200', r2.status === 200 && r2.json.ok === true);
  const privRow = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('private row updated in place', privRow && privRow[2] === 'second');
  ok('other private fields preserved', privRow && privRow[3] === '1/3');
}

console.log('Sheets API failures:');
{
  const r = await run('/write', 'test-token', { table: 'players', payload: { ign: 'X', roster_status: 'active', is_public: true } });
  const id = r.json.id;
  sheetsFail = 503;
  const r2 = await run('/update', 'test-token', { table: 'players', payload: { id, ign: 'X', primary_role: 'IGL' } });
  ok('update on sheets failure → 502', r2.status === 502 && r2.json.error.includes('update failed'));
}
{
  const r = await run('/write', 'test-token', { table: 'announcements', payload: { title: 'T', body: 'B', published_at: '2026-10-01' } });
  const id = r.json.id;
  sheetsFail = 500;
  const r2 = await run('/delete', 'test-token', { table: 'announcements', payload: { id } });
  ok('delete on sheets failure → 502', r2.status === 502 && r2.json.error.includes('delete failed'));
}

console.log('/delete recruitment private archive:');
{
  // Candidate WITH a private record → both public and private get archived.
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'DEL1', target_role: 'Rusher', trial_status: 'active', eval_notes: 'keep secret', practice_attendance: '2/3', is_public: false } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'recruitment', payload: { id } });
  ok('recruitment delete → 200', r2.status === 200 && r2.json.ok === true);
  const pubRow = sheets.recruitment.find(rr => rr[0] === id);
  ok('public row archived', pubRow && pubRow[7] === 'true');
  const privRow = sheets.recruitment_private.find(rr => rr[0] === id);
  ok('private row archived', privRow && privRow[5] === 'true');
  ok('private data preserved (not leaked/cleared)', privRow && privRow[2] === 'keep secret' && privRow[3] === '2/3');
}
{
  // Candidate WITHOUT a private record → delete must still succeed.
  const r = await run('/write', 'test-token', { table: 'recruitment', payload: { ign: 'DEL2', target_role: 'Sniper', trial_status: 'pending', is_public: true } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'recruitment', payload: { id } });
  ok('recruitment delete without private row → 200', r2.status === 200 && r2.json.ok === true);
  const pubRow = sheets.recruitment.find(rr => rr[0] === id);
  ok('public row still archived', pubRow && pubRow[7] === 'true');
}

console.log('phases routes:');
{
  const r = await run('/write', 'test-token', { table: 'phases', payload: { phase_no: 1, title: 'Foundation', description: 'Setup', status: 'in_progress', start_date: '2026-10-01' } });
  ok('phase write → 200', r.status === 200 && r.json.ok === true);
  const id = r.json.id;
  const row = sheets.phases.find(rr => rr[0] === id);
  ok('phase appended', row && row[2] === 'Foundation' && row[4] === 'in_progress');
  const r2 = await run('/update', 'test-token', { table: 'phases', payload: { id, phase_no: 1, title: 'Foundation', status: 'completed' } });
  ok('phase update → 200', r2.status === 200 && r2.json.ok === true);
  const row2 = sheets.phases.find(rr => rr[0] === id);
  ok('phase status updated', row2 && row2[4] === 'completed');
  const r3 = await run('/delete', 'test-token', { table: 'phases', payload: { id } });
  ok('phase delete → 200', r3.status === 200 && r3.json.ok === true);
  ok('phase archived', row2 && row2[8] === 'true');
}
console.log('tasks routes:');
{
  const rp = await run('/write', 'test-token', { table: 'phases', payload: { phase_no: 2, title: 'Phase 2', status: 'planned' } });
  const pid = rp.json.id;
  const r = await run('/write', 'test-token', { table: 'tasks', payload: { phase_id: pid, title: 'Build UI', done: false } });
  ok('task write → 200', r.status === 200 && r.json.ok === true);
  const id = r.json.id;
  const row = sheets.tasks.find(rr => rr[0] === id);
  ok('task appended with phase_id', row && row[1] === pid && row[2] === 'Build UI' && row[3] === false);
  const r2 = await run('/update', 'test-token', { table: 'tasks', payload: { id, phase_id: pid, title: 'Build UI', done: true } });
  ok('task update → 200', r2.status === 200 && r2.json.ok === true);
  const row2 = sheets.tasks.find(rr => rr[0] === id);
  ok('task done updated to true', row2 && row2[3] === true);
  const r3 = await run('/delete', 'test-token', { table: 'tasks', payload: { id } });
  ok('task delete → 200', r3.status === 200 && r3.json.ok === true);
  ok('task archived', row2 && row2[5] === 'true');
}
console.log('matches/journey delete (archived column):');
{
  const r = await run('/write', 'test-token', { table: 'matches', payload: { match_date: '2026-11-05', match_type: 'squad', status: 'scheduled', opponent: 'TeamX', roster: ['Jay'], is_public: true } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'matches', payload: { id } });
  ok('match delete → 200', r2.status === 200 && r2.json.ok === true);
  const row = sheets.matches.find(rr => rr[0] === id);
  ok('match archived flag set', row && row[12] === 'true');
}
{
  const r = await run('/write', 'test-token', { table: 'journey', payload: { date: '2026-10-20', category: 'formation', title: 'Team formed', verified: false } });
  const id = r.json.id;
  const r2 = await run('/delete', 'test-token', { table: 'journey', payload: { id } });
  ok('journey delete → 200', r2.status === 200 && r2.json.ok === true);
  const row = sheets.journey.find(rr => rr[0] === id);
  ok('journey archived flag set', row && row[7] === 'true');
}

console.log('phase/task validation rejects:');
{
  const r = await run('/write', 'test-token', { table: 'phases', payload: { title: 'P', status: 'done' } });
  ok('invalid phase status → 400', r.status === 400 && r.json.error.includes('Invalid phase status'));
}
{
  const r = await run('/write', 'test-token', { table: 'tasks', payload: { title: 'T' } });
  ok('task missing phase_id → 400', r.status === 400 && r.json.error.includes('phase_id required'));
}
{
  const r = await run('/write', 'test-token', { table: 'tasks', payload: { phase_id: 'x', title: 'T', done: 'yes' } });
  ok('task done not boolean → 400', r.status === 400 && r.json.error.includes('done must be a boolean'));
}

console.log('/apply (public, no token):');
{
  const r = await worker.fetch(makeApplyReq('/apply', '1.1.1.1', { payload: { ign: 'NEW.PLAYER', target_role: 'Rusher', contact: 'discord@x' } }), ENV);
  const j = await r.json();
  ok('valid public apply → 200', r.status === 200 && j.ok === true);
  const row = sheets.recruitment.find(rr => rr[0] === j.id);
  ok('apply appended recruitment row', row && row[1] === 'NEW.PLAYER');
  ok('apply sets trial_status pending', row && row[3] === 'pending');
  ok('apply sets is_public false', row && row[6] === 'false');
  ok('apply does not expose contact publicly', row && row.indexOf('discord@x') === -1);
}
{
  const r = await worker.fetch(makeApplyReq('/apply', '2.2.2.2', { payload: { ign: '', target_role: 'Rusher' } }), ENV);
  ok('apply missing ign → 400', r.status === 400);
}
{
  const r = await worker.fetch(makeApplyReq('/apply', '3.3.3.3', { payload: { ign: 'X', target_role: 'NotARole' } }), ENV);
  const j = await r.json();
  ok('apply invalid role → 400', r.status === 400 && j.error.includes('Invalid target role'));
}
{
  const r = await worker.fetch(makeApplyReq('/apply', '4.4.4.4', { payload: { ign: 'X', target_role: 'Rusher', website: 'http://spam.example' } }), ENV);
  const j = await r.json();
  ok('apply honeypot → accepted but spam (no write)', r.status === 200 && j.spam === true);
  ok('apply honeypot did not write', !sheets.recruitment.find(rr => rr[1] === 'X'));
}
{
  // Rate limit: 3 per IP per hour.
  for (let i = 0; i < 3; i++) {
    const r = await worker.fetch(makeApplyReq('/apply', '5.5.5.5', { payload: { ign: 'RL' + i, target_role: 'Sniper' } }), ENV);
    ok('apply rate-limit allowed within budget (' + (i + 1) + '/3)', r.status === 200);
  }
  const r4 = await worker.fetch(makeApplyReq('/apply', '5.5.5.5', { payload: { ign: 'RL3', target_role: 'Sniper' } }), ENV);
  ok('apply rate-limit blocks 4th → 429', r4.status === 429);
}

console.log('route fallthrough:');
{
  const r = await run('/bogus', 'test-token', { table: 'players', payload: { ign: 'X' } });
  ok('unknown route → 404', r.status === 404);
}

globalThis.fetch = realFetch;
crypto.subtle.importKey = realImportKey;
crypto.subtle.sign = realSign;

console.log(`\nworker-routes: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
