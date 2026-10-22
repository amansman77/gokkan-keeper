import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2];
const environment = process.argv[3] ?? 'production';
if (!['api', 'web', 'all'].includes(target) || !['production', 'preview'].includes(environment)
    || process.argv.length > 4 || (environment === 'preview' && target !== 'api')) {
  throw new Error('Usage: node scripts/deploy.mjs api|web|all [production|preview]');
}
function run(args) {
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Every supported entry point checks the whole repository before building fresh
// artifacts. Check failures stop before any Wrangler command runs.
run(['check']);
if (target !== 'api') run(['build']);
else run(['--filter', 'api', 'build']);
if (target !== 'web' && environment === 'production') run(['--filter', 'api', 'exec', 'wrangler', 'd1', 'migrations', 'apply', 'shared-db', '--remote', '--env', 'production']);
if (target !== 'web') run(['--filter', 'api', 'exec', 'wrangler', 'deploy', ...(environment === 'production' ? ['--env', 'production'] : [])]);
if (target !== 'api') run(['--filter', 'web', 'exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', 'gokkan-keeper-web', '--branch', 'main']);

if (environment === 'production') run(['smoke:prod', target]);
