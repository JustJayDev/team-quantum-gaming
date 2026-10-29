// ============================================================
// TQG — test for the Google Sheets CSV data layer
// Mocks fetch, verifies CSV parsing + boolean/roster coercion.
// Usage: node tests/csv.test.js
// ============================================================
import { api } from '../js/api.js';

const csvs = {
  players: 'id,ign,role_primary,roster_status\n1,Mystic,IGL,active\n2,"Rush, King",Rusher,trial\n',
};
globalThis.fetch = async (url) => {
  const m = /sheet=(.*)$/.exec(url);
  const tab = decodeURIComponent(m[1]);
  const body = csvs[tab];
  return { ok: !!body, status: body ? 200 : 404, text: async () => body };
};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name + ' — got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
}

console.log('api.players:');
eq('quoted field parsed', (await api.players()).length, 2);
const rows = await api.players();
eq('ign with comma kept intact', rows[1].ign, 'Rush, King');
eq('headers mapped', rows[0].role_primary, 'IGL');
eq('status kept', rows[0].roster_status, 'active');
eq('unknown tab throws', await api.tasks().then(() => 'no-throw').catch(e => e.message), 'Sheet tasks → 404');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
