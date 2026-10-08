import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function invoke(target, failAt, environment = 'production') {
  const directory = mkdtempSync(path.join(tmpdir(), 'gokkan-deploy-test-'));
  const log = path.join(directory, 'calls.jsonl');
  try {
    // Only this stub executes; tests never call Wrangler or deploy anything.
    writeFileSync(path.join(directory, 'pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === process.env.DEPLOY_TEST_FAIL) process.exit(23);
`, { mode: 0o755 });
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./deploy.mjs', import.meta.url)), target, environment], {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`,
        DEPLOY_TEST_LOG: log, DEPLOY_TEST_FAIL: failAt ?? '' },
    });
    const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    return { status: result.status, calls };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('failed quality checks prevent building and deployment', () => {
  const result = invoke('all', 'check');
  assert.equal(result.status, 23);
  assert.deepEqual(result.calls, [['check']]);
});
test('failed build prevents any deployment', () => {
  const result = invoke('all', 'build');
  assert.equal(result.status, 23);
  assert.deepEqual(result.calls, [['check'], ['build']]);
});
test('full production deploy checks once and builds before either publish', () => {
  assert.deepEqual(invoke('all').calls, [
    ['check'], ['build'],
    ['--filter', 'api', 'exec', 'wrangler', 'd1', 'migrations', 'apply', 'shared-db', '--remote', '--env', 'production'],
    ['--filter', 'api', 'exec', 'wrangler', 'deploy', '--env', 'production'],
    ['--filter', 'web', 'exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', 'gokkan-keeper-web', '--branch', 'main'],
    ['smoke:prod', 'all'],
  ]);
});
test('API preview preserves its target and still requires the whole quality gate', () => {
  assert.deepEqual(invoke('api', undefined, 'preview').calls, [
    ['check'], ['--filter', 'api', 'build'], ['--filter', 'api', 'exec', 'wrangler', 'deploy'],
  ]);
});
