// Review budgets are heuristics, not a universal limit on AI comprehension.
export const structureRules = {
  'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true }],
  complexity: ['warn', { max: 15, variant: 'classic' }],
  'max-depth': ['warn', 4],
  'max-params': ['warn', 5],
  'max-statements': ['warn', 50],
};
export const inventoryLimits = { directFiles: 25, directoryDepth: 6, sourceBytes: 32768, agentGuideBytes: 12288 };

// Ignore source line shifts, but keep the rule, function identity, value and count.
// Anonymous functions share a bucket; sorted values prevent one large violation
// from hiding several smaller new violations.
export function findingGroup(finding) {
  return `${finding.path}|${finding.rule}|${finding.message.replace(/(complexity of |lines \(|statements \(|deeply \(|parameters \()\d+/g, '$1#')}`;
}
export function groupFindings(findings) {
  const groups = {};
  for (const finding of findings) {
    const key = findingGroup(finding);
    const value = Number(finding.message.match(/(?:complexity of |lines \(|statements \(|deeply \(|parameters \()(\d+)/)?.[1]);
    if (!Number.isFinite(value)) throw new Error(`Unrecognized structure message: ${finding.message}`);
    (groups[key] ??= []).push(value);
  }
  for (const values of Object.values(groups)) values.sort((a, b) => b - a);
  return groups;
}
export function structureRegressions(findings, baseline) {
  const regressions = [];
  for (const [key, values] of Object.entries(groupFindings(findings))) {
    const allowed = baseline[key]?.values ?? [];
    values.forEach((value, index) => {
      if (index >= allowed.length || value > allowed[index]) regressions.push({ key, value, allowed: allowed[index] ?? null });
    });
  }
  return regressions;
}
export function inventoryRegressions(files, directories) {
  return [
    ...directories.filter(row => row.directFiles > inventoryLimits.directFiles).map(row => `${row.path}: ${row.directFiles} direct files > ${inventoryLimits.directFiles}`),
    ...directories.filter(row => row.path.split('/').length > inventoryLimits.directoryDepth).map(row => `${row.path}: directory depth > ${inventoryLimits.directoryDepth}`),
    ...files.filter(row => row.source && row.bytes > inventoryLimits.sourceBytes).map(row => `${row.path}: ${row.bytes} source bytes > ${inventoryLimits.sourceBytes}`),
    ...files.filter(row => row.path === 'AGENTS.md' && row.bytes > inventoryLimits.agentGuideBytes).map(row => `${row.path}: ${row.bytes} agent-guide bytes > ${inventoryLimits.agentGuideBytes}`),
  ];
}
