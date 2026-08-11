/**
 * Append-only Usage Records for LLM invocations.
 */

import { randomUUID } from 'crypto';
import { appendFileSync } from 'fs';

/**
 * @param {object} params
 * @param {string} params.task
 * @param {import('./types.mjs').ResolvedModelRoute} params.route
 * @param {import('./types.mjs').NormalizedUsage} params.usage
 * @param {number|null} params.estimatedCostUsd
 * @param {string} params.rateCardVersion
 * @param {number} params.latencyMs
 * @param {'success' | 'error' | 'timeout'} params.outcome
 * @param {number} params.attempt
 * @param {Record<string, unknown>} [params.metadata]
 * @returns {import('./types.mjs').UsageRecord}
 */
export function createUsageRecord({
  task,
  route,
  usage,
  estimatedCostUsd,
  rateCardVersion,
  latencyMs,
  outcome,
  attempt,
  metadata,
}) {
  return Object.freeze({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    task,
    provider: route.provider,
    model: route.model,
    spendTier: route.spendTier,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    cachedTokens: usage.cached_tokens,
    totalTokens: usage.total_tokens,
    estimatedCostUsd,
    rateCardVersion,
    latencyMs,
    outcome,
    attempt,
    ...(metadata ? { metadata: Object.freeze({ ...metadata }) } : {}),
  });
}

/**
 * In-memory append-only ledger. Production callers may supply a file/jsonl sink.
 */
export class UsageLedger {
  /** @param {{ sink?: (record: import('./types.mjs').UsageRecord) => void }} [options] */
  constructor(options = {}) {
    /** @type {import('./types.mjs').UsageRecord[]} */
    this.records = [];
    this.sink = options.sink ?? null;
    this._frozen = false;
  }

  /** @param {import('./types.mjs').UsageRecord} record */
  append(record) {
    if (this._frozen) {
      throw new Error('UsageLedger is frozen and cannot accept new records');
    }
    if (!record || typeof record !== 'object') {
      throw new Error('UsageRecord must be an object');
    }
    const frozen = Object.freeze({ ...record });
    this.records.push(frozen);
    this.sink?.(frozen);
    return frozen;
  }

  /** @returns {readonly import('./types.mjs').UsageRecord[]} */
  readAll() {
    return [...this.records];
  }

  freeze() {
    this._frozen = true;
    return this;
  }

  get length() {
    return this.records.length;
  }
}

/**
 * @param {UsageLedger} ledger
 * @param {import('./types.mjs').UsageRecord} record
 */
export function appendUsageRecord(ledger, record) {
  return ledger.append(record);
}

/**
 * @param {string} filePath
 * @param {{ appendFile?: typeof appendFileSync }} [deps]
 */
export function createFileSink(filePath, deps = {}) {
  const appendFile = deps.appendFile ?? appendFileSync;
  return (record) => {
    appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
  };
}
