// ============================================================
// TQG — Cloudflare Worker (admin writes)
// Validates the admin token, then appends a row to a Google Sheet
// via the Sheets API. The token and a service account credential
// live ONLY as Worker env secrets — never ship them in the repo.
// ============================================================
// Required env vars (set in the Worker dashboard, encrypted):
//   ADMIN_TOKEN    — the token the admin types at sign-in
//   SPREADSHEET_ID — the Google Sheet id (same as SHEET_ID)
//   SERVICE_ACCOUNT — full JSON of a Google service account that is
//                     a viewer/editor on the sheet (escaped, env)
const TABLE_TO_TAB = {
  players: 'players',
  announcements: 'announcements',
  matches: 'matches',
  recruitment: 'recruitment',
};

// Row columns per tab (must match the published sheet headers exactly).
const TAB_COLUMNS = {
  players:        ['id','ign','display_name','role_primary','role_secondary','roster_status','join_date','avatar_url','is_public'],
  announcements:   ['id','title','body','published_at','archived'],
  matches:         ['id','match_date','match_type','opponent','roster','placement','kills','points','notes','replay_url','is_public'],
  recruitment:     ['id','ign','target_role','trial_status','trial_date','decision','is_public'],
};
// Private tab used ONLY for recruitment evaluation notes. This tab is
// never published to the web, so it can never leak to the public.
const PRIVATE_TAB = 'recruitment_private';
const PRIVATE_COLUMNS = ['id', 'ign', 'eval_notes', 'practice_attendance', 'teamwork_assessment'];

// Lightweight Google OAuth2 JWT (RS256) using Web Crypto.
async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const body = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  const enc = o => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const signingInput = enc(header) + '.' + enc(body);
  const key = await crypto.subtle.importKey('pkcs8', base64UrlToBytes(sa.private_key.split('-----BEGIN PRIVATE KEY-----')[1].split('-----END PRIVATE KEY-----')[0]), { name: 'RSASSA-PKCS1-v1_5' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const b64 = b64FromBytes(sig).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(signingInput + '.' + b64),
  });
  if (!r.ok) throw new Error('token exchange failed ' + r.status);
  return (await r.json()).access_token;
}
function base64UrlToBytes(b64) {
  const b = b64.replace(/-/g,'+').replace(/_/g,'/');
  const p = atob(b);
  const bytes = new Uint8Array(p.length);
  for (let i = 0; i < p.length; i++) bytes[i] = p.charCodeAt(i);
  return bytes;
}
function b64FromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

// Append a row to the tab using the Sheets API (values:append).
async function appendRow(sa, sheetId, tab, values) {
  const token = await googleAccessToken(sa);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: tab + '!A1', majorDimension: 'ROWS', values: [values] }),
  });
  if (!r.ok) throw new Error('append failed ' + r.status);
  return r.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/write') {
      return new Response('Not found', { status: 404 });
    }
    // 1. Token check.
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    // 2. Parse + validate body.
    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
    const { table, payload } = body || {};
    const tab = TABLE_TO_TAB[table];
    const cols = TAB_COLUMNS[table];
    if (!tab || !cols || !payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ error: 'Unknown table' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // 4. Append to the public tab.
    let id = Math.random().toString(36).slice(2, 10);
    const row = cols.map(c => { if (c === 'id') return id; const v = payload[c]; return v === undefined || v === null ? '' : v; });

    // 5. For recruitment, also store private evaluation fields in the
    //    separate never-published tab.
    if (table === 'recruitment') {
      const privateRow = PRIVATE_COLUMNS.map(c => {
        if (c === 'id') return id;
        if (c === 'ign') return payload.ign || '';
        const v = payload[c];
        return v === undefined || v === null ? '' : v;
      });
      try {
        await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB, privateRow);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'private sheet write failed: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }
    try {
      await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, tab, row);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'sheet write failed: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
};