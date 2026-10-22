import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit, isAcceptedWatcherAdvisory } from './check-dependencies.mjs';

const watcher = {
  github_advisory_id: 'GHSA-vfj7-8cjw-p6xm', module_name: 'braces', severity: 'high',
  patched_versions: '<0.0.0',
  findings: [{ version: '3.0.3', paths: ['apps__web>tailwindcss>chokidar>braces'] }],
};
const today = new Date('2026-10-09T00:00:00Z');
test('watcher exception cannot cover runtime use, another version, or a released patch', () => {
  assert.equal(isAcceptedWatcherAdvisory(watcher, today), true);
  for (const changed of [
    { ...watcher, findings: [{ version: '3.0.3', paths: ['apps__api>braces'] }] },
    { ...watcher, findings: [{ version: '3.0.2', paths: watcher.findings[0].paths }] },
    { ...watcher, patched_versions: '>=3.0.4' },
    { ...watcher, severity: 'critical' },
  ]) assert.equal(isAcceptedWatcherAdvisory(changed, today), false);
});
test('watcher exception expires automatically', () => {
  assert.equal(isAcceptedWatcherAdvisory(watcher, new Date('2026-11-09T00:00:00Z')), false);
});
test('new high advisories still block and incomplete reports fail closed', () => {
  const report = {
    metadata: { vulnerabilities: { high: 2, critical: 0 } },
    advisories: { watcher, other: { module_name: 'hono', severity: 'high' } },
  };
  assert.equal(evaluateAudit(report, today).blocking.length, 1);
  assert.equal(evaluateAudit(report, today).accepted.length, 1);
  assert.throws(() => evaluateAudit({ error: 'registry unavailable' }));
  assert.throws(() => evaluateAudit({ ...report, advisories: {} }));
});
