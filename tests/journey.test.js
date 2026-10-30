// ============================================================
// TQG — journey timeline helper tests (js/journey-helpers.js)
// Covers deterministic ordering and confirmed/provisional/planned
// status classification. No DOM.
// Usage: node tests/journey.test.js
// ============================================================
import { sortJourney, journeyStatus, journeyStatusLabel } from '../js/journey-helpers.js';

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name + ' — got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
}

console.log('sortJourney:');
{
  const items = [
    { id: 'a', date: '2026-10-20', title: 'Team formed' },
    { id: 'b', date: '2026-09-01', title: 'Older' },
    { id: 'c', date: '2026-11-05', title: 'Newer' },
  ];
  const out = sortJourney(items).map(i => i.id);
  eq('sorted oldest → newest', out, ['b', 'a', 'c']);
}
{
  const items = [
    { id: 'z', date: '2026-10-01' },
    { id: 'a', date: '2026-10-01' },
  ];
  const out = sortJourney(items).map(i => i.id);
  eq('same date ties broken by id', out, ['a', 'z']);
}
{
  const items = [
    { id: 'm1', date: '' },
    { id: 'm2', date: '2026-09-01' },
  ];
  const out = sortJourney(items).map(i => i.id);
  eq('missing date sorts first (stable)', out, ['m1', 'm2']);
}

console.log('journeyStatus:');
eq('verified → confirmed', journeyStatus({ verified: true }), 'confirmed');
eq('provisional date', journeyStatus({ date_provisional: true }), 'provisional');
eq('planned default', journeyStatus({}), 'planned');
eq('null item → planned', journeyStatus(null), 'planned');
eq('verified beats provisional', journeyStatus({ verified: true, date_provisional: true }), 'confirmed');

console.log('journeyStatusLabel:');
eq('confirmed label', journeyStatusLabel('confirmed'), 'Confirmed');
eq('provisional label', journeyStatusLabel('provisional'), 'Provisional date');
eq('planned label', journeyStatusLabel('planned'), 'Planned');
eq('unknown → planned', journeyStatusLabel('nope'), 'Planned');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);