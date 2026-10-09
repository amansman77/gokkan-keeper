import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measureSource } from './structure-metrics.mjs';
import { inventoryLimits, inventoryRegressions, structureRegressions, structureRules } from './structure-policy.mjs';

const root = process.cwd();
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
const directories = new Map([['.', { path: '.', directFiles: 0 }]]);
const files = [];
for (const file of paths) {
  const info = await lstat(file).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (!info) continue; // A tracked deletion is not an audit failure.
  const source = !info.isSymbolicLink() && /\.(?:ts|tsx|js|mjs)$/.test(file);
  const row = { path: file, bytes: info.size, source };
  if (info.isSymbolicLink()) row.symlinkTarget = await readlink(file);
  else if (source || file.endsWith('.md')) {
    const content = await readFile(file, 'utf8');
    row.lines = content.length ? content.split('\n').length - Number(content.endsWith('\n')) : 0;
    row.maxLineLength = Math.max(0, ...content.split('\n').map(line => line.length));
  }
  files.push(row);
  const parent = path.dirname(file);
  for (let dir = parent; dir !== '.'; dir = path.dirname(dir)) {
    if (!directories.has(dir)) directories.set(dir, { path: dir, directFiles: 0 });
  }
  directories.get(parent).directFiles++;
}
const eslint = new ESLint({ overrideConfig: [{ files: ['**/*.{ts,tsx,js,mjs}'], rules: structureRules }] });
const results = await eslint.lintFiles(files.filter(row => row.source).map(row => row.path));
const findings = results.flatMap(result => result.messages.filter(message => message.ruleId in structureRules).map(message => ({
  path: path.relative(root, result.filePath), rule: message.ruleId, line: message.line, message: message.message,
})));
const errors = results.flatMap(result => result.messages.filter(message => message.severity === 2).map(message => `${path.relative(root, result.filePath)}:${message.line} ${message.message}`));
const baseline = JSON.parse(await readFile('scripts/structure-baseline.json', 'utf8'));
const regressions = structureRegressions(findings, baseline.exceptions);
const inventoryErrors = inventoryRegressions(files, [...directories.values()]);
const measurements = await measureSource(files.filter(row => row.source).map(row => row.path));
for (const file of files) if (file.source) file.codeLines = measurements.fileCodeLines[file.path] ?? 0;
const report = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tools: { node: process.version, eslint: ESLint.version }, rules: structureRules, inventoryLimits,
  fileCount: files.length, sourceFileCount: files.filter(row => row.source).length,
  directoryCount: directories.size - 1, functionCount: measurements.functions.length, functions: measurements.functions, files, directories: [...directories.values()], findings, regressions, inventoryErrors, errors,
};
await mkdir('test-results/structure-audit', { recursive: true });
await writeFile('test-results/structure-audit/metrics.json', JSON.stringify(report, null, 2) + '\n');
const lines = [
  '# Structure audit', '',
  'Review budgets are project heuristics, not guarantees of AI comprehension. Tracked and unignored new files are included; dependency/build/private/generated reports are excluded by gitignore.', '',
  `Files: ${report.fileCount}; source files: ${report.sourceFileCount}; directories: ${report.directoryCount}; functions: ${report.functionCount}.`, '',
  `Existing budget findings: ${findings.length}; new or increased findings: ${regressions.length}.`, '',
  '| File | Rule | Finding |', '| --- | --- | --- |',
  ...findings.map(row => `| ${row.path}:${row.line} | ${row.rule} | ${row.message} |`), '',
  'Largest source files by code lines:', '',
  '| File | Code lines | Bytes |', '| --- | --- | --- |',
  ...files.filter(row => row.source).sort((a, b) => b.codeLines - a.codeLines).slice(0, 15).map(row => `| ${row.path} | ${row.codeLines} | ${row.bytes} |`), '',
  ...inventoryErrors, ...errors,
];
await writeFile('test-results/structure-audit/report.md', lines.join('\n') + '\n');
for (const row of regressions) console.error(`${row.key}: ${row.value} > ${row.allowed ?? 'no exception'}`);
for (const error of [...inventoryErrors, ...errors]) console.error(error);
console.log(`Structure: ${report.fileCount} files, ${report.directoryCount} directories, ${findings.length} existing findings, ${regressions.length} regressions.`);
if (regressions.length || inventoryErrors.length || errors.length) process.exitCode = 1;
