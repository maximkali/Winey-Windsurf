import assert from 'node:assert/strict';
import { getGambitMinMaxSets, scoreGambitPicks, GAMBIT_MAX_POINTS } from '../src/lib/gambitScoring.mjs';

function run() {
  // No prices -> no sets
  {
    const sets = getGambitMinMaxSets([{ wineId: 'A', price: null }]);
    assert.equal(sets.hasPrices, false);
    assert.equal(sets.cheapestIds.size, 0);
    assert.equal(sets.mostExpensiveIds.size, 0);
  }

  // Simple min/max
  {
    const sets = getGambitMinMaxSets([
      { wineId: 'A', price: 10 },
      { wineId: 'B', price: 20 },
      { wineId: 'C', price: 30 },
    ]);
    assert.equal(sets.hasPrices, true);
    assert.deepEqual(Array.from(sets.cheapestIds.values()).sort(), ['A']);
    assert.deepEqual(Array.from(sets.mostExpensiveIds.values()).sort(), ['C']);

    const scored = scoreGambitPicks({ cheapestPickId: 'A', mostExpensivePickId: 'C' }, sets);
    assert.equal(scored.totalPoints, 3);
    assert.equal(scored.maxPoints, GAMBIT_MAX_POINTS);
  }

  // Tie-aware min/max
  {
    const sets = getGambitMinMaxSets([
      { wineId: 'A', price: 10 },
      { wineId: 'B', price: 10 },
      { wineId: 'C', price: 30 },
      { wineId: 'D', price: 30 },
      { wineId: 'E', price: 20 },
    ]);
    assert.equal(sets.hasPrices, true);
    assert.deepEqual(Array.from(sets.cheapestIds.values()).sort(), ['A', 'B']);
    assert.deepEqual(Array.from(sets.mostExpensiveIds.values()).sort(), ['C', 'D']);

    // Either tied min counts, either tied max counts
    assert.equal(scoreGambitPicks({ cheapestPickId: 'B', mostExpensivePickId: 'C' }, sets).totalPoints, 3);
    assert.equal(scoreGambitPicks({ cheapestPickId: 'A', mostExpensivePickId: 'D' }, sets).totalPoints, 3);

    // Wrong picks
    assert.equal(scoreGambitPicks({ cheapestPickId: 'E', mostExpensivePickId: 'D' }, sets).totalPoints, 2);
    assert.equal(scoreGambitPicks({ cheapestPickId: 'A', mostExpensivePickId: 'E' }, sets).totalPoints, 1);
    assert.equal(scoreGambitPicks({ cheapestPickId: 'E', mostExpensivePickId: 'E' }, sets).totalPoints, 0);
  }

  console.log('gambit-selfcheck: OK');
}

run();


