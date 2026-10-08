import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Ephemeral/authentication data must not resurrect on a data restore.
const excluded = new Set(['gk_sessions', 'gk_security_rate_limits', 'gk_security_audit_log', 'gk_quote_cache']);
const identifier = (name) => {
  if (!/^gk_[a-z_]+$/.test(name)) throw new Error('Unexpected table identifier');
  return `"${name}"`;
};
function literal(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  // Preserve SQLite REAL values rather than the JSON extension's shorter numeric encoding.
  if (value && typeof value === 'object' && typeof value.real === 'string'
      && /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.real) && Number.isFinite(Number(value.real))) return value.real;
  throw new Error('Unsupported SQL value');
}

/** Capture all persistent Gokkan rows in one SELECT snapshot, excluding other shared-db apps. */
export async function captureBackup(query) {
  const schema = await query("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND tbl_name GLOB 'gk_*' ORDER BY type, name");
  const tables = schema.filter((row) => row.type === 'table').map((row) => row.name);
  const columns = {};
  for (const table of tables) columns[table] = (await query(`PRAGMA table_info(${identifier(table)})`)).map((row) => row.name);
  const data = await query(`SELECT json_object(${tables.filter((table) => !excluded.has(table)).map((table) => {
    const pairs = columns[table].map((column) => `${literal(column)}, CASE WHEN typeof("${column}") = 'real' THEN json_object('real', printf('%!.17g', "${column}")) ELSE "${column}" END`).join(',');
    return `${literal(table)}, json((SELECT coalesce(json_group_array(json_object(${pairs})), '[]') FROM ${identifier(table)}))`;
  }).join(',')}) AS data`);
  // A concurrent schema migration invalidates the capture rather than creating a mixed backup.
  const after = await query("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND tbl_name GLOB 'gk_*' ORDER BY type, name");
  if (JSON.stringify(schema) !== JSON.stringify(after)) throw new Error('Schema changed during backup; retry after migrations finish');
  return { version: 1, exportedAt: new Date().toISOString(), schema, columns, data: JSON.parse(data[0].data) };
}

export function encryptBackup(backup, key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('GK_BACKUP_KEY must contain 64 hexadecimal characters');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(backup), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), payload: payload.toString('base64') });
}
export function decryptBackup(encrypted, key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('GK_BACKUP_KEY must contain 64 hexadecimal characters');
  const envelope = JSON.parse(encrypted);
  if (envelope.version !== 1) throw new Error('Unsupported backup version');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.payload, 'base64')), decipher.final()]).toString('utf8'));
}

/** A restore SQL file is for a NEW isolated DB only. No destructive DROP/DELETE is generated. */
export function restoreStatements(backup) {
  if (backup.version !== 1 || !backup.schema?.length) throw new Error('Invalid backup');
  const tables = backup.schema.filter((row) => row.type === 'table');
  // FK parents before children. Remaining tables have no domain FK dependencies.
  tables.sort((a, b) => (a.name === 'gk_granaries' ? -1 : 0) - (b.name === 'gk_granaries' ? -1 : 0));
  const result = tables.map((row) => { identifier(row.name); return row.sql; });
  for (const { name } of tables) {
    if (excluded.has(name)) continue;
    const columns = backup.columns[name];
    if (!columns?.every((column) => /^[a-z_]+$/.test(column))) throw new Error('Invalid column identifier');
    for (const row of backup.data[name] ?? []) {
      result.push(`INSERT INTO ${identifier(name)} (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map((c) => literal(row[c])).join(',')})`);
    }
  }
  result.push(...backup.schema.filter((row) => row.type !== 'table').map((row) => row.sql));
  result.push('PRAGMA foreign_key_check');
  return result;
}

async function main() {
  const [mode, file, scope] = process.argv.slice(2);
  if (!file || !['export', 'restore-sql'].includes(mode) || (scope && !['--local', '--remote'].includes(scope))) {
    throw new Error('Usage: node scripts/data-backup.mjs export FILE [--local|--remote] / restore-sql FILE');
  }
  const key = process.env.GK_BACKUP_KEY;
  if (mode === 'export') {
    // Fail before reading owner records if no encryption key is configured.
    encryptBackup({}, key);
    const run = promisify(execFile);
    const query = async (sql) => {
      const { stdout } = await run('pnpm', ['--filter', 'api', 'exec', 'wrangler', 'd1', 'execute', 'shared-db', scope ?? '--local', ...(scope === '--remote' ? ['--env', 'production'] : []), '--json', '--command', sql], { maxBuffer: 64 * 1024 * 1024 });
      const result = JSON.parse(stdout);
      if (!result.every((entry) => entry.success)) throw new Error('Backup query failed');
      return result.flatMap((entry) => entry.results);
    };
    const backup = await captureBackup(query);
    await writeFile(file, encryptBackup(backup, key), { mode: 0o600, flag: 'wx' });
    console.log(`Encrypted Gokkan backup written (${Object.keys(backup.data).length} tables).`);
  } else {
    const backup = decryptBackup(await readFile(file, 'utf8'), key);
    await writeFile(`${file}.restore.sql`, restoreStatements(backup).map((sql) => `${sql};`).join('\n'), { mode: 0o600, flag: 'wx' });
    console.log('Restore SQL written for inspection and import into a NEW isolated database.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Backup operation failed; check arguments, key, access and destination. Owner data is not logged.'); process.exitCode = 1; });
}
