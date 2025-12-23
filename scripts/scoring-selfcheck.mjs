import assert from 'node:assert/strict';
import { buildAcceptableByPosition, scoreRanking } from '../src/lib/scoring.mjs';

function run() {
  // All prices equal: every permutation should be fully correct.
  {
    const wines = [
      { wineId: 'A', price: 10 },
      { wineId: 'B', price: 10 },
      { wineId: 'C', price: 10 },
    ];
    const acceptable = buildAcceptableByPosition(wines);
    assert.equal(scoreRanking(acceptable, ['A', 'B', 'C']), 3);
    assert.equal(scoreRanking(acceptable, ['B', 'C', 'A']), 3);
    assert.equal(scoreRanking(acceptable, ['C', 'A', 'B']), 3);
  }

  // Two-way tie in the middle.
  {
    const wines = [
      { wineId: 'A', price: 30 },
      { wineId: 'B', price: 20 },
      { wineId: 'C', price: 20 },
      { wineId: 'D', price: 10 },
    ];
    const acceptable = buildAcceptableByPosition(wines);
    assert.equal(scoreRanking(acceptable, ['A', 'B', 'C', 'D']), 4);
    assert.equal(scoreRanking(acceptable, ['A', 'C', 'B', 'D']), 4);
    assert.equal(scoreRanking(acceptable, ['B', 'A', 'C', 'D']), 2); // only positions 2-3 correct here
  }

  // Null/unknown prices tie together at the bottom.
  {
    const wines = [
      { wineId: 'A', price: 30 },
      { wineId: 'B', price: null },
      { wineId: 'C', price: null },
    ];
    const acceptable = buildAcceptableByPosition(wines);
    assert.equal(scoreRanking(acceptable, ['A', 'B', 'C']), 3);
    assert.equal(scoreRanking(acceptable, ['A', 'C', 'B']), 3);
  }

  console.log('scoring-selfcheck: OK');
}

run();


