// SPDX-License-Identifier: MIT

import {
  pointOfSail, shipAP, inIrons, windShift, applyShift, moveApCost,
  POINT_OF_SAIL_AP, SHIP_MOVE_BUDGET,
} from '../../../src/js/engine/wind.js';

export function runTests(assert) {
  // pointOfSail
  assert('in irons: heading directly into wind',   pointOfSail(0, 3) === 0);
  assert('running: heading directly with wind',    pointOfSail(0, 0) === 3);
  assert('close reach: 1 step from windward',      pointOfSail(0, 2) === 1);
  assert('broad reach: 2 steps from windward',     pointOfSail(0, 1) === 2);
  assert('symmetry: same steps on either side',    pointOfSail(0, 4) === 1);
  assert('wraps correctly across direction 0',     pointOfSail(5, 2) === 0);

  // shipAP
  assert('in irons → 1 AP',    shipAP(0, 3) === 1);
  assert('close reach → 1 AP', shipAP(0, 2) === 1);
  assert('broad reach → 2 AP', shipAP(0, 1) === 2);
  assert('running → 3 AP',     shipAP(0, 0) === 3);

  // inIrons
  assert('inIrons true when heading into wind', inIrons(0, 3) === true);
  assert('inIrons false on close reach',        inIrons(0, 2) === false);

  // applyShift
  assert('applyShift wraps forward', applyShift(5, 1) === 0);
  assert('applyShift wraps back',    applyShift(0, -1) === 5);
  assert('applyShift zero',          applyShift(3, 0) === 3);

  // windShift distribution: over many seeds, verify all shift values appear
  // and the no-change bucket is the most common.
  const counts  = { '-3': 0, '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0 };
  const SAMPLES = 10000;
  for (let s = 0; s < SAMPLES; s++) counts[String(windShift(s, 1))]++;
  assert('windShift: no-change is most common',
    counts['0'] > counts['1'] && counts['0'] > counts['-1']);
  assert('windShift: small shifts dominate (≥ 85% of samples)',
    (counts['0'] + counts['1'] + counts['-1']) / SAMPLES >= 0.85);
  assert('windShift: big shifts occur (≥ 5% of samples)',
    (counts['2'] + counts['-2'] + counts['3'] + counts['-3']) / SAMPLES >= 0.05);
  assert('windShift: all shift values are reachable',
    Object.values(counts).every(c => c > 0));

  // POINT_OF_SAIL_AP array shape
  assert('POINT_OF_SAIL_AP has 4 entries',   POINT_OF_SAIL_AP.length === 4);
  assert('POINT_OF_SAIL_AP[0] is 1 (irons)', POINT_OF_SAIL_AP[0] === 1);
  assert('POINT_OF_SAIL_AP[3] is 3 (run)',   POINT_OF_SAIL_AP[3] === 3);

  // moveApCost — wind=0, windward=3
  assert('moveApCost: running (dir=0) costs 2',     moveApCost(0, 0) === 2);
  assert('moveApCost: broad reach (dir=1) costs 3', moveApCost(0, 1) === 3);
  assert('moveApCost: close reach (dir=2) costs 6', moveApCost(0, 2) === 6);
  assert('moveApCost: windward (dir=3) is Infinity', !isFinite(moveApCost(0, 3)));
  assert('moveApCost: close reach (dir=4) costs 6', moveApCost(0, 4) === 6);
  assert('moveApCost: broad reach (dir=5) costs 3', moveApCost(0, 5) === 3);
  assert('SHIP_MOVE_BUDGET equals 6',               SHIP_MOVE_BUDGET === 6);
  assert('budget / running cost = 3 running moves', SHIP_MOVE_BUDGET / moveApCost(0, 0) === 3);
  assert('budget / broad-reach cost = 2 moves',     SHIP_MOVE_BUDGET / moveApCost(0, 1) === 2);
  assert('budget / close-reach cost = 1 move',      SHIP_MOVE_BUDGET / moveApCost(0, 2) === 1);
}
