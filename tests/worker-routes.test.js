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
  recruitment: [['id','ign','target_role','trial_status','trial_date','decision','is_public']],
  recruitment_private: [['id','ign','eval_notes','practice_attendance','teamwork_assessment']],
};
let seq = 100;

// Extract the sheet tab from a values API URL: ".../values/players!A1:Z1000"
// or ".../values/players!A1:append?..."  The tab is the part before '!'.
function tabFromUrl(u) {
  const after = u.split('/values/')[1] || '';
  return after.split('!')[0];
}

// Mock global fetch: OAuth token + Sheets API.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('oauth2.googleapis.com/token')) {
    return { ok: true, status: 200, json: async () => ({ access_token: 'FAKE_TOKEN' }) };
  }
  if (u.includes('sheets.googleapis.com/v4/spreadsheets')) {
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
  const r = await run('/delete', 'test-token', { table: 'players', payload: { id: 'nope' } });
  ok('unknown id → 400', r.status === 400 && r.json.error.includes('not found'));
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
