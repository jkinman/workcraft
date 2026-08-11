/**
 * utils/token-tracker.mjs — Token tracking and cost estimation for career-ops
 *
 * Legacy facade — pricing and OpenAI usage normalization delegate to lib/llm/.
 */

import {
  estimateUsageCostSync,
  getLegacyRatesMap,
} from '../lib/llm/rate-card.mjs';
import { normalizeOpenAICompatibleUsage } from '../lib/llm/usage-normalize.mjs';

export const RATES = getLegacyRatesMap();

/**
 * Normalize an OpenAI-compatible usage object, applying safe defaults.
 *
 * @param {object|null|undefined} usage - Raw `data.usage` from the API response.
 * @returns {{ prompt_tokens: number, completion_tokens: number, total_tokens: number, cached_tokens: number }}
 */
export function normalizeOpenAIUsage(usage) {
  return normalizeOpenAICompatibleUsage(usage);
}

export function estimateCost(model, usage, provider) {
  return estimateUsageCostSync({ model, usage, provider });
}

export class TokenAccumulator {
  constructor() {
    this.steps = {};
  }

  record(stepName, usage) {
    if (!this.steps[stepName]) {
      this.steps[stepName] = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, isZeroToken: false };
    }
    if (usage === 0 || usage === null || usage === undefined) {
      const step = this.steps[stepName];
      const hasRealUsage = step.prompt_tokens > 0 || step.completion_tokens > 0 || step.total_tokens > 0 || step.cached_tokens > 0;
      if (!hasRealUsage) {
        step.isZeroToken = true;
      }
    } else {
      this.steps[stepName].isZeroToken = false;
      this.steps[stepName].prompt_tokens += usage.prompt_tokens || 0;
      this.steps[stepName].completion_tokens += usage.completion_tokens || 0;
      this.steps[stepName].total_tokens += usage.total_tokens || 0;
      this.steps[stepName].cached_tokens += usage.cached_tokens || 0;
    }
  }

  recordZeroToken(stepName) {
    this.record(stepName, null);
  }

  getTotals() {
    let prompt = 0;
    let completion = 0;
    let total = 0;
    let cached = 0;
    for (const step of Object.values(this.steps)) {
      if (!step.isZeroToken) {
        prompt += step.prompt_tokens;
        completion += step.completion_tokens;
        total += step.total_tokens;
        cached += step.cached_tokens;
      }
    }
    return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total, cached_tokens: cached };
  }
}

function formatK(tokens) {
  return (tokens / 1000).toFixed(1) + 'k';
}

export function formatBreakdown(accumulator, model, provider) {
  const lines = [];
  lines.push('Token breakdown:');
  
  const steps = ['scan', 'evaluation', 'pdf payload'];
  for (const key of Object.keys(accumulator.steps)) {
    if (!steps.includes(key)) {
      steps.push(key);
    }
  }

  for (const step of steps) {
    const data = accumulator.steps[step] || { isZeroToken: true };
    const label = (step + ':').padEnd(15);
    
    if (data.isZeroToken || (!data.prompt_tokens && !data.completion_tokens)) {
      lines.push(`  ${label}(zero-token by design)`);
    } else {
      const pK = formatK(data.prompt_tokens);
      const cK = formatK(data.completion_tokens);
      let line = `  ${label}${pK} prompt / ${cK} completion`;
      if (data.cached_tokens > 0) {
        line += ` (cached: ${formatK(data.cached_tokens)})`;
      }
      lines.push(line);
    }
  }

  const totals = accumulator.getTotals();
  const cost = estimateCost(model, totals, provider);
  const totalK = formatK(totals.total_tokens);
  const labelTotal = 'total:'.padEnd(15);
  const costStr = cost === null ? 'est. cost n/a' : `$${cost.toFixed(4)}`;
  lines.push(`  ${labelTotal}${totalK} tokens (${costStr})`);
  lines.push(`  (metadata: model=${model}, provider=${provider})`);
  return lines.join('\n');
}
