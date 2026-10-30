import {
  isCompleted, completedMatches, scheduledMatches, cancelledMatches,
  num, sumField, countField, avgField, bestPlacement, participation,
} from '../js/stats-helpers.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('PASS ' + label); }
  else { fail++; console.log('FAIL ' + label + ' — got ' + a + ', want ' + e); }
}

// Sample matches
const m = {
  scheduled: { id: 's1', status: 'scheduled', match_date: '2026-11-01', kills: '10', placement: '3', roster: ['A', 'B'] },
  cancelled: { id: 'c1', status: 'cancelled', match_date: '2026-11-02', kills: '5', placement: '4', roster: ['A'] },
  completed1: { id: 'd1', status: 'completed', match_date: '2026-11-03', kills: '12', placement: '2', roster: ['A', 'C'] },
  completed2: { id: 'd2', status: 'completed', match_date: '2026-11-04', kills: '8', placement: '5', roster: ['A', 'B'] },
};
const all = [m.scheduled, m.cancelled, m.completed1, m.completed2];

eq(isCompleted(m.completed1), true, 'isCompleted true for completed');
eq(isCompleted(m.scheduled), false, 'isCompleted false for scheduled');
eq(isCompleted({ status: '' }), false, 'isCompleted false for blank');
eq(isCompleted({}), false, 'isCompleted false for missing status');

eq(completedMatches(all).length, 2, 'completedMatches filters to completed only');
eq(scheduledMatches(all).length, 1, 'scheduledMatches count');
eq(cancelledMatches(all).length, 1, 'cancelledMatches count');

eq(num('12'), 12, 'num string');
eq(num(12), 12, 'num number');
eq(num(''), null, 'num blank → null');
eq(num('abc'), null, 'num NaN → null');
eq(num(undefined), null, 'num undefined → null');

eq(sumField(all, 'kills'), 20, 'sumField over completed only (12+8)');
eq(countField(all, 'kills'), 2, 'countField over completed');
eq(countField(all, 'placement'), 2, 'countField placement');
eq(avgField(all, 'kills'), 10, 'avgField kills');
eq(avgField(all, 'placement'), 3.5, 'avgField placement');
eq(avgField([m.scheduled], 'kills'), null, 'avgField scheduled-only → null');
eq(bestPlacement(all), 2, 'bestPlacement min over completed');

// Participation
const part = participation(all);
eq(part['A'], 2, 'participation A in 2 completed');
eq(part['B'], 1, 'participation B in 1 completed');
eq(part['C'], 1, 'participation C in 1 completed');
eq(part['S'], undefined, 'participation excludes scheduled-only roster');

// Empty / defensive
eq(completedMatches([]).length, 0, 'completedMatches empty');
eq(sumField([], 'kills'), 0, 'sumField empty → 0');
eq(avgField([], 'kills'), null, 'avgField empty → null');
eq(bestPlacement([]), null, 'bestPlacement empty → null');
eq(participation([]), {}, 'participation empty');
eq(participation([{ status: 'completed' }]), {}, 'participation completed match without roster');

console.log('--- stats-helpers: ' + pass + ' passed, ' + fail + ' failed ---');