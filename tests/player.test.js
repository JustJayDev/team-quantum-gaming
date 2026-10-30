// ============================================================
// TQG — player-profile helper tests (js/player.js)
// Covers role normalization, current vs previous role labels,
// achievements, missing fields, and public-data-only assumptions.
// Usage: node tests/player.test.js
// ============================================================
import { roleArray, currentRolesLabel, previousRolesLabel, hasRoles, achievementsList, profileCard } from '../js/player.js';

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name + ' — got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
}

console.log('roleArray:');
eq('array input', roleArray(['Sniper', 'IGL']), ['Sniper', 'IGL']);
eq('JSON string input', roleArray('["Sniper","IGL"]'), ['Sniper', 'IGL']);
eq('comma string input', roleArray('Sniper, IGL'), ['Sniper', 'IGL']);
eq('empty array', roleArray([]), []);
eq('empty string', roleArray(''), []);
eq('undefined', roleArray(undefined), []);
eq('null', roleArray(null), []);
eq('filters non-strings', roleArray(['Sniper', 7]), ['Sniper']);

console.log('currentRolesLabel:');
eq('primary only', currentRolesLabel({ primary_role: 'Sniper' }), 'Sniper');
eq('primary + secondary + temp, dedup', currentRolesLabel({ primary_role: 'IGL', secondary_roles: ['Sniper'], temporary_roles: ['Sniper', 'IGL'] }), 'IGL · Sniper');
eq('no roles', currentRolesLabel({}), '');

console.log('previousRolesLabel:');
eq('previous list', previousRolesLabel({ previous_roles: ['Sniper', 'IGL'] }), 'Sniper · IGL');
eq('dedup previous', previousRolesLabel({ previous_roles: ['Sniper', 'Sniper'] }), 'Sniper');
eq('no previous', previousRolesLabel({}), '');

console.log('hasRoles:');
eq('false when no roles', hasRoles({}), false);
eq('true via primary', hasRoles({ primary_role: 'Sniper' }), true);
eq('true via secondary', hasRoles({ secondary_roles: ['IGL'] }), true);
eq('true via previous', hasRoles({ previous_roles: ['Rusher'] }), true);

console.log('achievementsList:');
eq('array', achievementsList({ achievements: ['MVP'] }), ['MVP']);
eq('empty', achievementsList({}), []);

console.log('profileCard (markup):');
{
  const card = profileCard({ ign: 'TQG.KAIZEN07', roster_status: 'active', primary_role: 'IGL', secondary_roles: ['Sniper'], previous_roles: ['Sniper'], achievements: ['MVP'] });
  eq('contains ign', card.includes('TQG.KAIZEN07'), true);
  eq('contains status', card.includes('active'), true);
  eq('contains current label', card.includes('Current'), true);
  eq('contains previous label', card.includes('Previous'), true);
  eq('contains achievement', card.includes('MVP'), true);
  eq('escapes ign', profileCard({ ign: '<script>x</script>', roster_status: 'active' }).includes('&lt;script&gt;'), true);
}
{
  const card = profileCard({ ign: 'TQG.NOROLES', roster_status: 'trial' });
  eq('omits current when none', card.includes('Current'), false);
  eq('omits previous when none', card.includes('Previous'), false);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
