const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const CONFIG = require('../../config');

/**
 * Load tenant usage records from data/llm-usage.jsonl (no prompts or secrets).
 *
 * @param {import('../data/career-ops-data-client').CareerOpsDataClient} dataClient
 */
async function loadTenantUsageRecords(dataClient) {
  const key = dataClient.repository.dataPath('llm-usage.jsonl');
  if (!dataClient.repository.exists(key)) return [];
  const content = dataClient.repository.readText(key);
  if (!content) return [];

  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Build tenant-authorized LLM observability report.
 *
 * @param {import('../data/career-ops-data-client').CareerOpsDataClient} dataClient
 * @param {object} [options]
 * @param {string} [options.tenantId]
 * @param {{ softLimitUsd?: number, hardLimitUsd?: number }} [options.budgetLimits]
 */
async function buildTenantObservabilityReport(dataClient, options = {}) {
  const observability = await import('../../../lib/llm/observability.mjs');
  const records = await loadTenantUsageRecords(dataClient);

  const profilePath = dataClient.repository.profilePath();
  let budgetLimits = options.budgetLimits ?? {};
  if (dataClient.repository.exists(profilePath)) {
    const profileText = dataClient.repository.readText(profilePath);
    if (profileText) {
      const softMatch = profileText.match(/llm_budget_soft_usd:\s*([\d.]+)/);
      const hardMatch = profileText.match(/llm_budget_hard_usd:\s*([\d.]+)/);
      if (softMatch) budgetLimits = { ...budgetLimits, softLimitUsd: parseFloat(softMatch[1]) };
      if (hardMatch) budgetLimits = { ...budgetLimits, hardLimitUsd: parseFloat(hardMatch[1]) };
    }
  }

  return observability.buildObservabilityReport({
    records,
    tenantId: options.tenantId,
    budgetLimits,
  });
}

function createLlmObservabilityService(dataClient, tenantContext = {}) {
  return {
    async getUsageSummary(options = {}) {
      return buildTenantObservabilityReport(dataClient, {
        tenantId: tenantContext.tenantId,
        ...options,
      });
    },
  };
}

module.exports = {
  buildTenantObservabilityReport,
  createLlmObservabilityService,
  loadTenantUsageRecords,
};
