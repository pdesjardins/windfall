// SPDX-License-Identifier: MIT

import { runTests as hexTests } from './engine/hex.test.js';
import { runTests as terrainTests } from './engine/terrain.test.js';
import { runTests as fogTests } from './engine/fog.test.js';
import { runTests as gameTests } from './engine/game.test.js';

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  PASS: ${description}`);
    passed++;
  } else {
    console.error(`  FAIL: ${description}`);
    failed++;
  }
}

console.log('Running unit tests...\n');

// Sprint 0: infrastructure smoke test
console.log('Infrastructure');
assert('test runner executes', true);
assert('Node.js version is sufficient', parseInt(process.versions.node) >= 18);

// Sprint 1A: hex math
console.log('\nHex Math (hex.js)');
hexTests(assert);

// Sprint 1A: terrain generation
console.log('\nTerrain Generation (terrain.js)');
terrainTests(assert);

// Sprint 2A: fog of war
console.log('\nFog of War (fog.js)');
fogTests(assert);

// Sprint 2A: game state
console.log('\nGame State (game.js)');
gameTests(assert);

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
