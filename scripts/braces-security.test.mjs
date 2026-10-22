import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const tailwindRequire = createRequire(webRequire.resolve('tailwindcss'));
const watcherRequire = createRequire(tailwindRequire.resolve('chokidar'));
const braces = watcherRequire('braces');

test('watcher brace patch preserves ordinary globs and rejects pathological nesting without stack exhaustion', () => {
  assert.deepEqual(braces.expand('src/{pages,components}/*.{ts,tsx}'), ['src/pages/*.ts', 'src/pages/*.tsx', 'src/components/*.ts', 'src/components/*.tsx']);
  assert.equal(braces.stringify(braces.parse('src/{pages,components}/*.tsx')), 'src/{pages,components}/*.tsx');
  const pattern = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
  const bounded = (error) => error instanceof SyntaxError && error.message.includes('maximum depth');
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) assert.throws(() => operation(pattern), bounded);
  const cyclic = { type: 'root', nodes: [] }; cyclic.nodes.push(cyclic);
  for (const operation of [braces.compile, braces.expand, braces.stringify]) assert.throws(() => operation(cyclic), bounded);
});
