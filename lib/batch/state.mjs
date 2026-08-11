/**
 * Batch state TSV — parse, select, and upsert rows under filesystem lock.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { acquireFilesystemLock } from '../filesystem-lock.mjs';

export const BATCH_STATE_HEADER = 'id\turl\tstatus\tstarted_at\tcompleted_at\treport_num\tscore\terror\tretries';

export const BATCH_STATE_COLUMNS = [
  'id', 'url', 'status', 'started_at', 'completed_at', 'report_num', 'score', 'error', 'retries',
];

/**
 * Sanitize free-text fields that would corrupt a TSV row.
 * @param {string} value
 */
export function sanitizeBatchField(value) {
  return String(value ?? '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ');
}

/**
 * @param {string} stateFilePath
 */
export function initBatchStateFile(stateFilePath) {
  if (!existsSync(stateFilePath)) {
    writeFileSync(stateFilePath, `${BATCH_STATE_HEADER}\n`, 'utf8');
  }
}

/**
 * @param {string} stateFilePath
 * @returns {Map<string, Record<string, string>>}
 */
export function readBatchStateMap(stateFilePath) {
  initBatchStateFile(stateFilePath);
  const rows = new Map();
  const lines = readFileSync(stateFilePath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim() || line.startsWith('id\t')) continue;
    const parts = line.split('\t');
    if (parts.length < BATCH_STATE_COLUMNS.length) continue;
    const row = Object.fromEntries(BATCH_STATE_COLUMNS.map((col, i) => [col, parts[i] ?? '']));
    rows.set(row.id, row);
  }
  return rows;
}

/**
 * @param {string} stateFilePath
 * @param {string} id
 */
export function getBatchStatus(stateFilePath, id) {
  const row = readBatchStateMap(stateFilePath).get(String(id));
  return row?.status || 'none';
}

/**
 * @param {string} stateFilePath
 * @param {string} id
 */
export function getBatchRetries(stateFilePath, id) {
  const row = readBatchStateMap(stateFilePath).get(String(id));
  return row?.retries || '0';
}

/**
 * @param {object} row
 */
export function formatBatchStateRow(row) {
  return BATCH_STATE_COLUMNS.map(col => sanitizeBatchField(row[col] ?? '')).join('\t');
}

/**
 * Upsert one batch state row atomically under lock.
 *
 * @param {string} stateFilePath
 * @param {Record<string, string>} row
 * @param {object} [options]
 */
export async function upsertBatchStateRow(stateFilePath, row, options = {}) {
  const lockDir = options.lockDir || join(dirname(stateFilePath), '.batch-state.lock');
  const lock = await acquireFilesystemLock(lockDir, {
    timeoutMs: options.timeoutMs ?? 30_000,
    retryMs: options.retryMs ?? 100,
    staleMs: options.staleMs ?? 10 * 60_000,
    ownerMeta: { stateFile: stateFilePath },
  });

  try {
    const rows = readBatchStateMap(stateFilePath);
    rows.set(String(row.id), {
      id: String(row.id),
      url: row.url ?? '',
      status: row.status ?? 'none',
      started_at: row.started_at ?? '-',
      completed_at: row.completed_at ?? '-',
      report_num: row.report_num ?? '-',
      score: row.score ?? '-',
      error: sanitizeBatchField(row.error ?? '-'),
      retries: row.retries ?? '0',
    });

    const tmp = `${stateFilePath}.tmp`;
    const body = [BATCH_STATE_HEADER, ...[...rows.values()].map(formatBatchStateRow)].join('\n') + '\n';
    writeFileSync(tmp, body, 'utf8');
    renameSync(tmp, stateFilePath);
    return rows.get(String(row.id));
  } finally {
    lock.release();
  }
}

/**
 * @param {string} stateFilePath
 * @param {object} [filters]
 */
export function selectBatchRows(stateFilePath, filters = {}) {
  const rows = [...readBatchStateMap(stateFilePath).values()];
  return rows.filter(row => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.retryFailed && row.status !== 'failed') return false;
    if (filters.resumePaused && row.status !== 'paused_rate_limit') return false;
    if (filters.startFrom != null && Number(row.id) < Number(filters.startFrom)) return false;
    return true;
  });
}

/**
 * Summarize batch progress for --status output.
 *
 * @param {string} stateFilePath
 */
export function summarizeBatchState(stateFilePath) {
  const rows = [...readBatchStateMap(stateFilePath).values()];
  const counts = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return { total: rows.length, counts, rows };
}
