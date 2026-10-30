// ============================================================
// TQG — tests for the Worker validation module
// Covers: unknown tables, malformed payloads, invalid statuses,
// missing ids/required fields, disallowed protected fields, and
// private-field routing for recruitment.
// Usage: node tests/validate.test.js
// ============================================================
import { validateWrite } from '../worker/validate.js';

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}
function rejects(name, table, payload, substr) {
  const r = validateWrite(table, payload);
  ok(name + ' (rejects)', r.ok === false && (!substr || r.error.includes(substr)));
}

console.log('recruitment private-field routing:');
{
  const r = validateWrite('recruitment', { ign: 'X', target_role: 'Rusher', eval_notes: 'secret', practice_attendance: '3/3' });
  ok('routes private fields to privateFields map when r.ok === true && r.privateFields.eval_notes === "secret"', r.ok === true && r.privateFields.eval_notes === 'secret');
  ok('removes private fields from public payload', !('eval_notes' in r.payload) && !('practice_attendance' in r.payload));
  ok('keeps public fields intact', r.payload.ign === 'X' && r.payload.target_role === 'Rusher');
}
console.log('unknown table:');
rejects('unknown table', 'hackers', {}, 'Unknown table');
console.log('malformed payload:');
rejects('array payload', 'players', ['x'], 'Payload must be an object');
rejects('null payload', 'players', null, 'Payload must be an object');
console.log('players validation:');
rejects('missing ign', 'players', {}, 'IGN required');
rejects('invalid roster_status', 'players', { ign: 'X', roster_status: 'boss' }, 'Invalid roster_status');
rejects('invalid primary_role', 'players', { ign: 'X', primary_role: 'Hacker' }, 'Invalid primary_role');
rejects('secondary not array', 'players', { ign: 'X', secondary_roles: 'Sniper' }, 'array of strings');
rejects('secondary invalid role in array', 'players', { ign: 'X', secondary_roles: ['Sniper', 'Chef'] }, 'invalid role');
ok('valid player passes', validateWrite('players', { ign: 'TQG.KAIZEN07', primary_role: null, secondary_roles: ['Sniper'], roster_status: 'active' }).ok === true);
console.log('disallowed / protected fields:');
rejects('disallowed extra field', 'players', { ign: 'X', admin_secret: 'leak' }, 'Disallowed field');
rejects('disallowed on announcements', 'announcements', { title: 'T', body: 'B', service_role_key: 'x' }, 'Disallowed field');
console.log('journey validation:');
rejects('missing date', 'journey', { category: 'formation', title: 'T' }, 'date required');
rejects('invalid category', 'journey', { date: '2026-10-20', category: 'win', title: 'T' }, 'Invalid category');
rejects('missing title', 'journey', { date: '2026-10-20', category: 'formation' }, 'title required');
ok('valid journey passes', validateWrite('journey', { date: '2026-10-20', date_provisional: true, category: 'formation', title: 'Team formed', verified: false }).ok === true);
console.log('matches validation:');
rejects('missing match_date', 'matches', { match_type: 'squad' }, 'match_date required');
rejects('invalid type', 'matches', { match_date: '2026-11-01', match_type: 'clanwar' }, 'Invalid match_type');
rejects('roster not array', 'matches', { match_date: '2026-11-01', roster: 'x' }, 'array of strings');
ok('valid match passes', validateWrite('matches', { match_date: '2026-11-01', match_type: 'scrim', roster: ['Jay'], placement: 3 }).ok === true);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);