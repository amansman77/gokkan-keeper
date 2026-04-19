import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'production';
const cwd = process.cwd();

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function resolveEnv(modeName) {
  const env = {};
  const files = [
    '.env',
    '.env.local',
    `.env.${modeName}`,
    `.env.${modeName}.local`,
  ];

  for (const relativePath of files) {
    const absolutePath = path.join(cwd, relativePath);
    Object.assign(env, parseEnvFile(absolutePath));
  }

  return { ...env, ...process.env };
}

const resolvedEnv = resolveEnv(mode);
const requiredVars = ['VITE_GOOGLE_CLIENT_ID'];
const missingVars = requiredVars.filter((name) => !resolvedEnv[name] || !String(resolvedEnv[name]).trim());

if (missingVars.length > 0) {
  console.error('[build-env] Missing required build-time env vars:');
  for (const name of missingVars) {
    console.error(`- ${name}`);
  }
  console.error('\nSet them in one of these files (recommended) or shell env:');
  console.error(`- ${path.join(cwd, `.env.${mode}`)}`);
  console.error(`- ${path.join(cwd, `.env.${mode}.local`)}`);
  process.exit(1);
}

console.log(`[build-env] ${requiredVars.join(', ')} OK for mode="${mode}"`);
