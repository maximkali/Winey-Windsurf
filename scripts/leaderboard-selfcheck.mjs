import assert from 'node:assert/strict';
import { shouldIncludeGambitPoints } from '../src/lib/leaderboardGating.mjs';

function run() {
  assert.equal(shouldIncludeGambitPoints('setup'), false);
  assert.equal(shouldIncludeGambitPoints('lobby'), false);
  assert.equal(shouldIncludeGambitPoints('in_progress'), false);
  // Critical regression check: Gambit points must NOT be applied during the gambit phase.
  assert.equal(shouldIncludeGambitPoints('gambit'), false);
  assert.equal(shouldIncludeGambitPoints('finished'), true);

  console.log('leaderboard-selfcheck: OK');
}

run();


