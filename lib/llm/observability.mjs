/**
 * LLM usage observability — tenant-safe summaries, budget alerts, route audit.
 * Usage records and exports must never contain prompts, API keys, or secrets.
 */

import { getRateCardVersion, loadRateCard } from './rate-card.mjs';
import { TELEMETRY } from './telemetry.mjs';
import { assertUsageRecordSafe } from './sanitize.mjs';

export { assertUsageRecordSafe } from './sanitize.mjs';

/**
 * @param {readonly import('./types.mjs').UsageRecord[]} records
 */
export function summarizeUsageRecords(records, options = {}) {
  const filtered = records.filter((r) => {
    if (options.tenantId && r.metadata?.tenantId && r.metadata.tenantId !== options.tenantId) return false;
    if (options.task && r.task !== options.task) return false;
    return true;
  });

  /** @type {Map<string, { task: string, provider: string, model: string, count: number, totalTokens: number, totalCostUsd: number, errors: number, timeouts: number, totalLatencyMs: number }>} */
  const groups = new Map();

  for (const record of filtered) {
    assertUsageRecordSafe(record);
    const key = `${record.task}|${record.provider}|${record.model}`;
    const existing = groups.get(key) ?? {
      task: record.task,
      provider: record.provider,
      model: record.model,
      count: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      errors: 0,
      timeouts: 0,
      totalLatencyMs: 0,
    };
    existing.count += 1;
    existing.totalTokens += record.totalTokens ?? 0;
    existing.totalCostUsd += record.estimatedCostUsd ?? 0;
    existing.totalLatencyMs += record.latencyMs ?? 0;
    if (record.outcome === 'error') existing.errors += 1;
    if (record.outcome === 'timeout') existing.timeouts += 1;
    groups.set(key, existing);
  }

  return [...groups.values()].map((g) => ({
    ...g,
    avgLatencyMs: g.count ? Math.round(g.totalLatencyMs / g.count) : 0,
    errorRate: g.count ? g.errors / g.count : 0,
  }));
}

/**
 * @param {readonly import('./types.mjs').UsageRecord[]} records
 */
export function computeUsageMetrics(records) {
  let totalCostUsd = 0;
  let totalLatencyMs = 0;
  let errors = 0;
  let timeouts = 0;
  let successes = 0;

  for (const record of records) {
    assertUsageRecordSafe(record);
    totalCostUsd += record.estimatedCostUsd ?? 0;
    totalLatencyMs += record.latencyMs ?? 0;
    if (record.outcome === 'success') successes += 1;
    else if (record.outcome === 'timeout') timeouts += 1;
    else errors += 1;
  }

  const count = records.length;
  return {
    count,
    successes,
    errors,
    timeouts,
    totalCostUsd,
    avgLatencyMs: count ? Math.round(totalLatencyMs / count) : 0,
    errorRate: count ? (errors + timeouts) / count : 0,
  };
}

/**
 * @param {readonly import('./types.mjs').UsageRecord[]} records
 * @param {{ softLimitUsd?: number, hardLimitUsd?: number }} limits
 */
export function evaluateBudgetAlerts(records, limits = {}) {
  const metrics = computeUsageMetrics(records);
  const alerts = [];

  if (limits.softLimitUsd != null && metrics.totalCostUsd >= limits.softLimitUsd) {
    alerts.push({
      level: 'soft',
      type: 'budget_soft_exceeded',
      message: `Soft budget threshold exceeded: $${metrics.totalCostUsd.toFixed(4)} >= $${limits.softLimitUsd}`,
      totalCostUsd: metrics.totalCostUsd,
      thresholdUsd: limits.softLimitUsd,
    });
  }

  if (limits.hardLimitUsd != null && metrics.totalCostUsd >= limits.hardLimitUsd) {
    alerts.push({
      level: 'hard',
      type: 'budget_hard_exceeded',
      message: `Hard budget limit exceeded: $${metrics.totalCostUsd.toFixed(4)} >= $${limits.hardLimitUsd}`,
      totalCostUsd: metrics.totalCostUsd,
      thresholdUsd: limits.hardLimitUsd,
    });
  }

  return { metrics, alerts, blocked: alerts.some((a) => a.level === 'hard') };
}

/**
 * @param {readonly import('./telemetry.mjs').TelemetryEvent[]} events
 */
export function buildRouteAuditTrail(events) {
  const trail = [];
  for (const event of events) {
    if (![
      TELEMETRY.ROUTE_RESOLVED,
      TELEMETRY.ROUTE_ATTEMPT,
      TELEMETRY.ROUTE_FALLBACK,
      TELEMETRY.ROUTES_EXHAUSTED,
      TELEMETRY.BUDGET_BLOCKED,
    ].includes(event.type)) {
      continue;
    }
    trail.push({
      type: event.type,
      timestamp: event.timestamp,
      provider: event.data?.provider ?? null,
      model: event.data?.model ?? null,
      spendTier: event.data?.spendTier ?? null,
      attempt: event.data?.attempt ?? null,
      reason: event.data?.reason ?? null,
    });
  }
  return trail;
}

/**
 * Historical route audit rebuilt from persisted Usage Record metadata.
 *
 * @param {readonly import('./types.mjs').UsageRecord[]} records
 */
export function buildRouteAuditFromRecords(records) {
  const trail = [];
  for (const record of records) {
    assertUsageRecordSafe(record);
    const audit = record.metadata?.routeAudit;
    if (!audit || typeof audit !== 'object') continue;
    trail.push({
      type: 'usage.route_audit',
      timestamp: record.timestamp,
      provider: audit.selectedProvider ?? record.provider ?? null,
      model: audit.selectedModel ?? record.model ?? null,
      spendTier: audit.spendTier ?? record.spendTier ?? null,
      attempt: record.attempt ?? null,
      routeIndex: audit.routeIndex ?? null,
      fallbackCount: audit.fallbackCount ?? null,
      routesAvailable: audit.routesAvailable ?? null,
      budgetBlocked: audit.budgetBlocked ?? false,
      budgetReason: audit.budgetReason ?? null,
      outcome: record.outcome,
    });
  }
  return trail;
}

/**
 * @param {readonly import('./types.mjs').UsageRecord[]} records
 * @param {object} [options]
 */
export function checkRateCardWarnings(records, options = {}) {
  const currentVersion = options.currentVersion ?? getRateCardVersion(loadRateCard());
  const maxAgeDays = options.maxAgeDays ?? 90;
  const warnings = [];

  const versions = new Set(records.map((r) => r.rateCardVersion).filter(Boolean));
  for (const version of versions) {
    if (version !== currentVersion) {
      warnings.push({
        type: 'stale_rate_card',
        message: `Usage recorded against rate card ${version}; current is ${currentVersion}`,
        recordedVersion: version,
        currentVersion,
      });
    }
  }

  if (records.length === 0) {
    warnings.push({
      type: 'missing_usage',
      message: 'No usage records available for observability summary',
    });
  }

  const staleCutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const oldest = records.reduce((min, r) => {
    const ts = Date.parse(r.timestamp);
    return Number.isFinite(ts) && ts < min ? ts : min;
  }, Date.now());

  if (records.length > 0 && oldest < staleCutoff) {
    warnings.push({
      type: 'stale_usage_window',
      message: `Oldest usage record is older than ${maxAgeDays} days`,
      oldestTimestamp: new Date(oldest).toISOString(),
    });
  }

  return warnings;
}

/**
 * @param {object} params
 */
export function buildObservabilityReport({
  records,
  telemetryEvents = [],
  tenantId,
  budgetLimits = {},
}) {
  for (const record of records) {
    assertUsageRecordSafe(record);
  }

  const summaries = summarizeUsageRecords(records, { tenantId });
  const metrics = computeUsageMetrics(records);
  const budget = evaluateBudgetAlerts(records, budgetLimits);
  const routeAuditFromRecords = buildRouteAuditFromRecords(records);
  const routeAuditFromTelemetry = buildRouteAuditTrail(telemetryEvents);
  const routeAudit = routeAuditFromRecords.length > 0 ? routeAuditFromRecords : routeAuditFromTelemetry;
  const rateCardWarnings = checkRateCardWarnings(records);

  return Object.freeze({
    tenantId: tenantId ?? null,
    generatedAt: new Date().toISOString(),
    rateCardVersion: getRateCardVersion(loadRateCard()),
    summaries,
    metrics,
    budgetAlerts: budget.alerts,
    budgetBlocked: budget.blocked,
    routeAudit,
    routeAuditSource: routeAuditFromRecords.length > 0 ? 'usage-records' : 'telemetry',
    rateCardWarnings,
  });
}
