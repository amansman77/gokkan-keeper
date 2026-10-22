import { ESLint } from 'eslint';
import path from 'node:path';

/** ESLint counts JSX and excludes blank/comment-only lines, just like the gate. */
export async function measureSource(files) {
  const eslint = new ESLint({ overrideConfig: [{ files: ['**/*.{ts,tsx,js,mjs}'], rules: {
    complexity: ['warn', { max: 0, variant: 'classic' }],
    'max-lines-per-function': ['warn', { max: 0, skipBlankLines: true, skipComments: true, IIFEs: true }],
    'max-lines': ['warn', { max: 0, skipBlankLines: true, skipComments: true }],
  } }] });
  const functions = new Map();
  const fileCodeLines = {};
  for (const result of await eslint.lintFiles(files)) {
    const file = path.relative(process.cwd(), result.filePath);
    for (const message of result.messages) {
      if (message.ruleId === 'max-lines') {
        fileCodeLines[file] = Number(message.message.match(/lines \((\d+)\)/)[1]);
        continue;
      }
      if (!['complexity', 'max-lines-per-function'].includes(message.ruleId)) continue;
      const key = `${file}:${message.line}:${message.column}`;
      const row = functions.get(key) ?? { path: file, line: message.line, column: message.column, name: message.message.split(' has ')[0] };
      if (message.ruleId === 'complexity') row.complexity = Number(message.message.match(/complexity of (\d+)/)[1]);
      else row.codeLines = Number(message.message.match(/lines \((\d+)\)/)[1]);
      functions.set(key, row);
    }
  }
  return { functions: [...functions.values()], fileCodeLines };
}
