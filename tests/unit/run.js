// SPDX-License-Identifier: MIT

// Unit test runner. Engine modules will be tested here as they are implemented.
// Sprint 0 has no engine modules; this runner confirms the test infrastructure works.

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

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
