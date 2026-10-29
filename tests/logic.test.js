// ============================================================
// TQG — unit tests for data logic (run via node)
// Usage: node tests/logic.test.js
// ============================================================
import { phaseProgress, overallProgress } from '../js/api.js';

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name + ' — got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
}

console.log('phaseProgress:');
eq('all undone → 0', phaseProgress([
  { phase_id: 'a', done: false }, { phase_id: 'a', done: false },
], 'a'), 0);
eq('half done → 50', phaseProgress([
  { phase_id: 'a', done: true }, { phase_id: 'a', done: false },
], 'a'), 50);
eq('no tasks → 0', phaseProgress([], 'a'), 0);
eq('empty phase id → 0', phaseProgress([{ phase_id: 'b', done: true }], 'a'), 0);

console.log('overallProgress:');
eq('empty phases → 0', overallProgress([], []), 0);
eq('single phase 100', overallProgress(
  [{ phase_id: 'a', done: true }], [{ id: 'a' }]), 100);
eq('two phases avg 50', overallProgress(
  [{ phase_id: 'a', done: true }, { phase_id: 'b', done: false }],
  [{ id: 'a' }, { id: 'b' }]), 50);
eq('mixed 25% = 25', overallProgress(
  [{ phase_id: 'a', done: true }, { phase_id: 'a', done: false },
   { phase_id: 'b', done: false }, { phase_id: 'b', done: false }],
  [{ id: 'a' }, { id: 'b' }]), 25);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);