import { spawn } from 'node:child_process';
import { writeSync } from 'node:fs';
import { mkdir, open, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
for (const [label, args] of [
  ['prepare', ['--filter', 'shared', 'build']],
  ['tooling', ['exec', 'node', '--test', ...(await readdir(new URL('.', import.meta.url))).filter((name) => name.endsWith('.test.mjs')).map((name) => `scripts/${name}`)]],
  ['coverage', ['test:coverage']],
  ['integration', ['--filter', 'api', 'test:integration']],
]) {
  const log = await open(new URL(`../test-results/${label}.log`, import.meta.url), 'w');
  const status = await new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { process.stdout.write(chunk); writeSync(log.fd, chunk); });
    child.stderr.on('data', (chunk) => { process.stderr.write(chunk); writeSync(log.fd, chunk); });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  }).finally(() => log.close());
  if (status !== 0) process.exit(status);
}
