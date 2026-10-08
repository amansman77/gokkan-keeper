import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// This unpatched issue is limited to Tailwind's local file watcher; its patterns
// are repository-owned. See DEVELOPMENT.md. The exception expires automatically.
export function isAcceptedWatcherAdvisory(advisory, today = new Date()) {
  return today < new Date('2026-11-09T00:00:00Z')
    && advisory.github_advisory_id === 'GHSA-vfj7-8cjw-p6xm'
    && advisory.module_name === 'braces'
    && advisory.severity === 'high'
    && advisory.patched_versions === '<0.0.0'
    && advisory.findings?.length > 0
    && advisory.findings.every((finding) => finding.version === '3.0.3'
      && finding.paths?.length > 0
      && finding.paths.every((path) => path === 'apps__web>tailwindcss>chokidar>braces'));
}

export function evaluateAudit(report, today = new Date()) {
  if (!report.metadata?.vulnerabilities || !report.advisories) {
    throw new Error('Dependency audit did not return a complete report');
  }
  const blocking = [];
  const accepted = [];
  for (const advisory of Object.values(report.advisories)) {
    if (isAcceptedWatcherAdvisory(advisory, today)) accepted.push(advisory);
    else if (['high', 'critical'].includes(advisory.severity)) blocking.push(advisory);
  }
  // Inconsistent/partial reports must never turn a failed audit into a pass.
  const reported = report.metadata.vulnerabilities;
  if ((reported.high + reported.critical) !== [...blocking, ...accepted].reduce((count, advisory) => count + (advisory.findings?.length ?? 1), 0)) {
    throw new Error('Dependency audit severity totals do not match its advisories');
  }
  return { blocking, accepted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const audit = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
    if (audit.error || ![0, 1].includes(audit.status)) throw audit.error ?? new Error(audit.stderr || 'Dependency audit failed');
    const report = JSON.parse(audit.stdout);
    const { blocking, accepted } = evaluateAudit(report);
    console.log('Dependency audit:', report.metadata.vulnerabilities);
    for (const advisory of accepted) console.warn(`Temporary watcher exception (expires 2026-11-09): ${advisory.github_advisory_id}`);
    for (const advisory of blocking) console.error(`${advisory.severity}: ${advisory.module_name} ${advisory.url}`);
    process.exitCode = blocking.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
