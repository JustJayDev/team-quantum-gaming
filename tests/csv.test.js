// ============================================================
// TQG — test for the Google Sheets CSV data layer
// Mocks fetch, verifies CSV parsing, array coercers, boolean
// coercion, and soft-delete filtering for announcements.
// Usage: node tests/csv.test.js
// ============================================================
import { api } from '../js/api.js';

const csvs = {
  players: 'id,ign,primary_role,secondary_roles,temporary_roles,previous_roles,roster_status,archived\n1,TQG.KAIZEN07,,"[""Sniper""]","[""Sniper"",""IGL""]","[""Sniper""]",active,\n2,TQG.SCOP07,Sniper,[],[],[],active,\n8,TQG.GONE,Sniper,[],[],[],former,true\n',
  recruitment: 'id,ign,target_role,trial_status,trial_date,decision,archived\n3,ASTROO !!!,Supporter,trial,,pending,\n9,OLD.KIT,Supporter,former,,rejected,true\n',
  announcements: 'id,title,body,published_at,archived\n4,Hi,Hello,2026-10-01,false\n5,Old,Gone,2026-09-01,true\n',
  matches: 'id,match_date,match_type,roster,placement,kills,archived\n6,2026-11-01,scrim,"[""Jay"",""Aman""]",3,7,\n10,2026-09-01,squad,[],8,2,true\n',
  journey: 'id,date,date_provisional,category,title,description,verified,archived\n7,2026-10-20,true,formation,Team formed,Provisional,false,\n11,2026-09-01,false,scrim,Old scrim,Gone,true,true\n',
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

console.log('api.players (role arrays):');
const players = await api.players();
eq('array length', players.length, 2);
eq('primary_role null when blank', players[0].primary_role, null);
eq('primary_role kept', players[1].primary_role, 'Sniper');
eq('secondary_roles parsed', players[0].secondary_roles, ['Sniper']);
eq('temporary_roles parsed', players[0].temporary_roles, ['Sniper','IGL']);
eq('previous_roles parsed', players[0].previous_roles, ['Sniper']);
eq('empty arrays', players[1].secondary_roles, []);
eq('IGN exact', players[0].ign, 'TQG.KAIZEN07');

console.log('api.recruitment:');
eq('recruitment parsed', (await api.recruitment())[0].ign, 'ASTROO !!!');

console.log('api.players (soft-delete filter):');
eq('archived player filtered out', (await api.players()).length, 2);

console.log('api.recruitment (soft-delete filter):');
eq('archived recruitment filtered out', (await api.recruitment()).length, 1);

console.log('api.matches (soft-delete filter):');
eq('archived match filtered out', (await api.matches()).length, 1);

console.log('api.journey (soft-delete filter):');
eq('archived journey filtered out', (await api.journey()).length, 1);

console.log('api.announcements (soft-delete filter):');
const anns = await api.announcements();
eq('archived filtered out', anns.length, 1);
eq('survivor kept', anns[0].title, 'Hi');

console.log('api.matches (roster array):');
const m = await api.matches();
eq('roster parsed', m[0].roster, ['Jay','Aman']);
eq('kills numeric string kept', m[0].kills, '7');

console.log('api.journey (provisional flag):');
const j = await api.journey();
eq('date_provisional true', j[0].date_provisional, true);
eq('verified false', j[0].verified, false);
eq('category', j[0].category, 'formation');

console.log('unknown tab throws:');
eq('unknown tab throws', await api.tasks().then(() => 'no-throw').catch(e => e.message), 'Sheet tasks → 404');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);