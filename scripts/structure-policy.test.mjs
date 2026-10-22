import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findingGroup, groupFindings, inventoryRegressions, structureRegressions } from './structure-policy.mjs';
const finding = (value, name = 'rule001') => ({ path: 'apps/api/src/example.ts', rule: 'complexity', line: 10, message: `Function '${name}' has a complexity of ${value}. Maximum allowed is 15.` });
test('structure budgets compare values and counts rather than shifting line numbers', () => {
  const initial = finding(20);
  const baseline = { [findingGroup(initial)]: { values: [20] } };
  assert.equal(structureRegressions([{ ...finding(19), line: 100 }], baseline).length, 0);
  assert.equal(structureRegressions([finding(21)], baseline).length, 1);
  assert.equal(structureRegressions([finding(20), finding(16)], baseline).length, 1);
  assert.equal(structureRegressions([finding(16, 'newFunction')], baseline).length, 1);
  assert.equal(structureRegressions([{ ...finding(16), path: 'new-file.ts' }], baseline).length, 1);
  assert.deepEqual(groupFindings([finding(16), finding(20)]), { [findingGroup(initial)]: [20, 16] });
  assert.equal(structureRegressions([], baseline).length, 0);
});
test('inventory budgets reject crowded folders, deep folders, large source and agent guides', () => {
  assert.equal(inventoryRegressions([{ path: 'asset.png', bytes: 999999, source: false }], [{ path: 'apps/web/src', directFiles: 25 }]).length, 0);
  const files = [{ path: 'example.ts', bytes: 32769, source: true }, { path: 'AGENTS.md', bytes: 12289 }];
  const dirs = [{ path: 'a/b/c/d/e/f/g', directFiles: 26 }];
  assert.equal(inventoryRegressions(files, dirs).length, 4);
});
