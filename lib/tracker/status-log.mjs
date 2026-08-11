/**
 * Status transition ledger — append-only status-log.tsv beside applications.md.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

/**
 * @param {string} trackerPath - Canonical applications.md path.
 */
export function statusLogPathForTracker(trackerPath) {
  return join(dirname(trackerPath), 'status-log.tsv');
}

/**
 * Append one transition row. Observation-only — failures should not block tracker writes.
 */
export async function appendStatusLogEntry({
  trackerPath,
  trackerNum,
  date,
  fromStatus,
  toStatus,
  source = 'set-status',
  writeFn,
  readExists,
}) {
  const logPath = statusLogPathForTracker(trackerPath);
  const line = [
    String(trackerNum),
    date,
    fromStatus || '-',
    toStatus,
    source,
    '',
  ].join('\t');

  if (typeof writeFn === 'function') {
    await Promise.resolve(writeFn(`${line}\n`));
    return logPath;
  }

  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${line}\n`, 'utf8');
  return logPath;
}
