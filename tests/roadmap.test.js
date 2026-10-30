// ============================================================
// TQG — roadmap helper tests (js/roadmap-helpers.js)
// Covers status classification, pill classes, ordering, and honest
// no-tasks detection. No DOM.
// Usage: node tests/roadmap.test.js
// ============================================================
import { normalizeStatus, statusPillClass, statusLabel, phaseSortKey, hasNoTasks, sortPhases } from '../js/roadmap-helpers.js';

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name + ' — got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
}

console.log('normalizeStatus:');
eq('planned', normalizeStatus('planned'), 'planned');
eq('in_progress', normalizeStatus('in_progress'), 'in_progress');
eq('blocked', normalizeStatus('blocked'), 'blocked');
eq('completed', normalizeStatus('completed'), 'completed');
eq('delayed → blocked', normalizeStatus('delayed'), 'blocked');
eq('unknown → planned', normalizeStatus('whatever'), 'planned');
eq('empty → planned', normalizeStatus(''), 'planned');

console.log('statusPillClass:');
eq('planned grey', statusPillClass('planned'), 'grey');
eq('in_progress cyan', statusPillClass('in_progress'), 'cyan');
eq('blocked red', statusPillClass('blocked'), 'red');
eq('completed lime', statusPillClass('completed'), 'lime');

console.log('statusLabel:');
eq('planned', statusLabel('planned'), 'Planned');
eq('in_progress', statusLabel('in_progress'), 'In progress');
eq('blocked', statusLabel('blocked'), 'Blocked');
eq('completed', statusLabel('completed'), 'Completed');
eq('delayed label', statusLabel('delayed'), 'Blocked');

console.log('phaseSortKey:');
eq('planned 0', phaseSortKey({ status: 'planned' }), 0);
eq('in_progress 1', phaseSortKey({ status: 'in_progress' }), 1);
eq('blocked 2', phaseSortKey({ status: 'blocked' }), 2);
eq('completed 3', phaseSortKey({ status: 'completed' }), 3);

console.log('hasNoTasks:');
eq('no tasks → true', hasNoTasks({ id: 'p1' }, []), true);
eq('phase with tasks → false', hasNoTasks({ id: 'p1' }, [{ phase_id: 'p1' }]), false);
eq('other phase tasks → true', hasNoTasks({ id: 'p1' }, [{ phase_id: 'p2' }]), true);

console.log('sortPhases:');
{
  const out = sortPhases([
    { id: 'a', status: 'completed', phase_no: 1 },
    { id: 'b', status: 'planned', phase_no: 2 },
    { id: 'c', status: 'in_progress', phase_no: 3 },
  ]).map(p => p.id);
  eq('status order planned→in_progress→completed', out, ['b', 'c', 'a']);
}
{
  const out = sortPhases([
    { id: 'x', status: 'planned', phase_no: 2 },
    { id: 'y', status: 'planned', phase_no: 1 },
  ]).map(p => p.id);
  eq('same status by phase_no', out, ['y', 'x']);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);