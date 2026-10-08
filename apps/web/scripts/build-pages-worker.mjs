import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

// Cloudflare Pages expects this name in the built output, not in public assets.
const source = await readFile(new URL('../server/worker.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
await writeFile(new URL('../dist/_worker.js', import.meta.url), outputText);
console.log('[build-pages-worker] server/worker.ts → dist/_worker.js');
