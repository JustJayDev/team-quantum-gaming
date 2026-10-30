// ============================================================
// TQG — Cloudflare Worker (admin writes/updates/deletes)
// Validates the admin token on every request, then performs the
// Sheets API call. Public tabs are whitelisted in worker/validate.js;
// private recruitment fields never touch the public sheet.
// ============================================================
// Required env vars (set in the Worker dashboard, encrypted):
//   ADMIN_TOKEN      — the token the admin types at sign-in
//   SPREADSHEET_ID  — the Google Sheet id (same as SHEET_ID)
//   SERVICE_ACCOUNT — full JSON of a Google service account that is
//                      a viewer/editor on the sheet (escaped, env)
import { validateWrite, TAB_COLUMNS, PRIVATE_COLUMNS, PRIVATE_TAB, TABLE_TO_TAB, ROLES } from './validate.js';

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

// Read a tab's values (headers + rows).
async function readTab(sa, sheetId, tab) {
  const token = await googleAccessToken(sa);
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}!A1:Z1000`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!r.ok) throw new Error('read failed ' + r.status);
  const d = await r.json();
  return d.values || [];
}

// Append a row to a tab.
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

// Update a row by its 1-based index (row 1 = headers).
async function updateRow(sa, sheetId, tab, rowIndex, values) {
  const token = await googleAccessToken(sa);
  const col = String.fromCharCode(64 + values.length);
  const range = `${encodeURIComponent(tab)}!A${rowIndex}:${col}${rowIndex}`;
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values: [values] }),
  });
  if (!r.ok) throw new Error('update failed ' + r.status);
  return r.json();
}

function json(res, status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function badRequest(msg) { return json(null, 400, { error: msg }); }

export default {
  // Simple in-memory rate limiter for the public /apply route.
  // Keyed by client IP; bounded and pruned. Not a security boundary —
  // it is a courtesy throttle. A real deployment should use Cloudflare
  // rate limiting or a durable store.
  _applyRate: new Map(),

  _rateLimit(ip) {
    const now = Date.now();
    const window = 60 * 60 * 1000; // 1 hour
    const max = 3;                  // 3 applications / hour / IP
    const entry = this._applyRate.get(ip) || { times: [] };
    entry.times = entry.times.filter(t => now - t < window);
    if (entry.times.length >= max) return true;
    entry.times.push(now);
    this._applyRate.set(ip, entry);
    // Prune stale entries occasionally (at most 1000 slots).
    if (this._applyRate.size > 1000) {
      for (const [k, v] of this._applyRate) {
        v.times = v.times.filter(t => now - t < window);
        if (!v.times.length) this._applyRate.delete(k);
      }
    }
    return false;
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    // ---- PUBLIC APPLY (no admin token required) ----
    // Prospective players submit an application. This route NEVER accepts
    // private fields and never exposes the candidate until an admin
    // approves. It is strictly whitelisted, honeypot-protected, and
    // lightly rate-limited per IP.
    if (url.pathname === '/apply') {
      let body;
      try { body = await request.json(); } catch { return badRequest('Bad JSON'); }
      const payload = (body && body.payload) || {};

      // Honeypot: a hidden "website" field is not a real field. If a bot
      // filled it, silently accept without writing (so bots cannot probe).
      const honeypot = String(payload.website || '').trim();
      if (honeypot) return json(null, 200, { ok: false, spam: true });

      // Rate limit by client IP (Cloudflare header or fallback).
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (this._rateLimit(ip)) return json(null, 429, { error: 'Too many applications — try again later.' });

      // Strict whitelist: only public, non-sensitive fields.
      const ign = typeof payload.ign === 'string' ? payload.ign.trim() : '';
      const target_role = typeof payload.target_role === 'string' ? payload.target_role.trim() : '';
      const contact = typeof payload.contact === 'string' ? payload.contact.trim() : '';

      if (!ign) return badRequest('IGN is required');
      if (ign.length > 40) return badRequest('IGN is too long');
      if (/[\x00-\x1f\x7f]/.test(ign)) return badRequest('IGN contains invalid characters');
      if (!ROLES.has(target_role)) return badRequest('Invalid target role');

      const id = Math.random().toString(36).slice(2, 10);
      // Recruitment columns: id, ign, target_role, trial_status, trial_date, decision, is_public, archived
      const row = [id, ign, target_role, 'pending', '', 'pending', 'false', ''];
      try {
        await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, 'recruitment', row);
      } catch (e) {
        return json(null, 502, { error: 'apply failed: ' + e.message });
      }
      return json(null, 200, { ok: true, id, message: 'Application received. We will be in touch.' });
    }

    // All other routes require the admin token.
    if (token !== env.ADMIN_TOKEN) {
      return json(null, 401, { error: 'Unauthorized' });
    }
    let body;
    try { body = await request.json(); } catch { return badRequest('Bad JSON'); }
    const { table, payload } = body || {};

    // ---- DELETE (soft-delete by id) ----
    // Delete only needs (table, id) — it must NOT run full write
    // validation (a payload for a create requires title/body etc.,
    // which is irrelevant to archiving an existing row).
    if (url.pathname === '/delete') {
      const tab = TABLE_TO_TAB[table];
      if (!tab) return badRequest('Unknown table');
      if (!payload.id || typeof payload.id !== 'string') return badRequest('id required');
      try {
        const rows = await readTab(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, tab);
        const headers = rows[0] || [];
        const idIdx = headers.indexOf('id');
        if (idIdx < 0) return badRequest('tab has no id column');
        const archivedIdx = headers.indexOf('archived');
        let found = -1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][idIdx] === payload.id) { found = i + 1; break; }
        }
        if (found < 0) return badRequest('id not found');
        // Soft-delete: set `archived` = true if the column exists.
        if (archivedIdx >= 0) {
          const vals = rows[found - 1];
          vals[archivedIdx] = 'true';
          await updateRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, tab, found, vals);
        } else {
          return badRequest('tab does not support soft-delete (no archived column)');
        }
        // Recruitment: also archive the matching private row (if one exists).
        // The private tab has an `archived` column (see PRIVATE_COLUMNS), so we
        // set it to 'true' — the private data is preserved but marked archived,
        // never exposed publicly. Missing private row is not an error: some
        // candidates have no private record.
        if (table === 'recruitment') {
          try {
            const pRows = await readTab(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB);
            const pH = pRows[0] || [];
            const pIdIdx = pH.indexOf('id');
            const pArchivedIdx = pH.indexOf('archived');
            let pFound = -1;
            for (let i = 1; i < pRows.length; i++) {
              if (pRows[i][pIdIdx] === payload.id) { pFound = i + 1; break; }
            }
            if (pFound > 0 && pArchivedIdx >= 0) {
              const pCur = pRows[pFound - 1].slice();
              pCur[pArchivedIdx] = 'true';
              await updateRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB, pFound, pCur);
            }
          } catch (e) {
            // Private archive failure must not fail the public delete or leak
            // private data into the response. Surface it in the log only.
            console.warn('recruitment private archive skipped: ' + e.message);
          }
        }
        return json(null, 200, { ok: true, id: payload.id });
      } catch (e) {
        return json(null, 502, { error: 'delete failed: ' + e.message });
      }
    }

    // ---- UPDATE (by id) ----
    if (url.pathname === '/update') {
      const v = validateWrite(table, payload);
      if (!v.ok) return badRequest(v.error);
      if (!payload.id || typeof payload.id !== 'string') return badRequest('id required');
      const tab = v.tab;
      try {
        const rows = await readTab(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, tab);
        const headers = rows[0] || [];
        const idIdx = headers.indexOf('id');
        if (idIdx < 0) return badRequest('tab has no id column');
        let found = -1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][idIdx] === payload.id) { found = i + 1; break; }
        }
        if (found < 0) return badRequest('id not found');
        // Build the updated row from current values, applying only non-id fields.
        const current = rows[found - 1];
        const updated = headers.map((h, idx) => {
          if (h === 'id') return current[idx] ?? payload.id;
          if (payload[h] !== undefined) {
            return Array.isArray(payload[h]) ? JSON.stringify(payload[h]) : payload[h];
          }
          return current[idx] ?? '';
        });
        await updateRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, tab, found, updated);
        // If recruitment update changed private fields, update private tab too.
        if (table === 'recruitment' && Object.keys(v.privateFields).length) {
          const pRows = await readTab(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB);
          const pH = pRows[0] || [];
          const pIdIdx = pH.indexOf('id');
          let pFound = -1;
          for (let i = 1; i < pRows.length; i++) {
            if (pRows[i][pIdIdx] === payload.id) { pFound = i + 1; break; }
          }
          if (pFound > 0) {
            const pCur = pRows[pFound - 1];
            const pUpdated = pH.map((h, idx) => {
              if (h === 'id') return pCur[idx] ?? payload.id;
              if (v.privateFields[h] !== undefined) return v.privateFields[h];
              return pCur[idx] ?? '';
            });
            await updateRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB, pFound, pUpdated);
          } else {
            await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB,
              PRIVATE_COLUMNS.map(c => c === 'id' ? payload.id : (v.privateFields[c] ?? '')));
          }
        }
        return json(null, 200, { ok: true, id: payload.id });
      } catch (e) {
        return json(null, 502, { error: 'update failed: ' + e.message });
      }
    }

    // ---- WRITE (create) ----
    if (url.pathname === '/write') {
      const v = validateWrite(table, payload);
      if (!v.ok) return badRequest(v.error);
      const id = Math.random().toString(36).slice(2, 10);
      const row = v.cols.map(c => {
        if (c === 'id') return id;
        const val = v.payload[c];
        if (val === undefined || val === null) return '';
        return Array.isArray(val) ? JSON.stringify(val) : val;
      });
      try {
        await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, v.tab, row);
        if (table === 'recruitment' && Object.keys(v.privateFields).length) {
          await appendRow(env.SERVICE_ACCOUNT, env.SPREADSHEET_ID, PRIVATE_TAB,
            PRIVATE_COLUMNS.map(c => c === 'id' ? id : (v.privateFields[c] ?? '')));
        }
      } catch (e) {
        return json(null, 502, { error: 'write failed: ' + e.message });
      }
      return json(null, 200, { ok: true, id });
    }

    return json(null, 404, { error: 'Not found' });
  },
};