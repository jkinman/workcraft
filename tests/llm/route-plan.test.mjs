import { pass, fail } from '../helpers.mjs';
import {
  buildExecutionRoutePlan,
  enforceBudgetBeforeCall,
  filterRoutesForBudget,
} from '../../lib/llm/route-plan.mjs';
import { BudgetBlockedError } from '../../lib/llm/failure-policy.mjs';
import { resolveModelRoute } from '../../lib/llm/routing.mjs';

console.log('\nllm route-plan & budget enforcement tests');

try {
  const primary = resolveModelRoute({
    hints: { provider: 'openai-compatible', spendTier: 'standard' },
    env: { OPENAI_API_KEY: 'sk-test' },
  });
  const plan = buildExecutionRoutePlan(primary, {});
  if (plan.routes.length >= 2) {
    pass('buildExecutionRoutePlan includes primary + fallback routes by default');
  } else {
    fail(`expected multi-route plan, got ${plan.routes.length}`);
  }

  const explicitPlan = buildExecutionRoutePlan(primary, {
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
  });
  if (explicitPlan.routes.length === 1 && explicitPlan.explicitOverride) {
    pass('explicit provider/model override disables cross-provider fallback by default');
  } else {
    fail(`explicit override should be single-route, got ${explicitPlan.routes.length}`);
  }

  const optInPlan = buildExecutionRoutePlan(primary, {
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    allowCrossProviderFallback: true,
  });
  if (optInPlan.routes.length >= 2) {
    pass('allowCrossProviderFallback opt-in restores fallback chain for explicit routes');
  } else {
    fail('opt-in fallback failed');
  }

  const cheap = () => 0.001;
  const expensive = () => 0.05;
  const unknown = () => null;

  const routes = plan.routes;
  const viable = filterRoutesForBudget(routes, {
    ceiling: 0.01,
    estimateForRoute: (r) => (r.adapterId === 'gemini' ? cheap() : expensive()),
    unknownPricingPolicy: 'allow',
  });
  if (viable.length === 1 && viable[0].adapterId === 'gemini') {
    pass('filterRoutesForBudget keeps routes within ceiling');
  } else {
    fail(`budget filter unexpected: ${JSON.stringify(viable.map((r) => r.adapterId))}`);
  }

  try {
    enforceBudgetBeforeCall(routes, {
      ceiling: 0.001,
      estimateForRoute: expensive,
      unknownPricingPolicy: 'block',
    });
    fail('expected BudgetBlockedError when all priced routes exceed ceiling');
  } catch (err) {
    if (err instanceof BudgetBlockedError && err.details.reason === 'all_priced_routes_exceed_ceiling') {
      pass('enforceBudgetBeforeCall throws before adapter when all priced routes exceed ceiling');
    } else {
      fail(`unexpected budget error: ${err.message}`);
    }
  }

  try {
    enforceBudgetBeforeCall(routes, {
      ceiling: 0.01,
      estimateForRoute: unknown,
      unknownPricingPolicy: 'assume-max',
    });
    fail('expected BudgetBlockedError for assume-max unknown pricing');
  } catch (err) {
    if (err instanceof BudgetBlockedError && err.details.reason === 'unknown_pricing_assumed_over_ceiling') {
      pass('unknownPricingPolicy assume-max blocks when ceiling set and pricing unknown');
    } else {
      fail(`assume-max error unexpected: ${err.message}`);
    }
  }

  const allowedUnknown = enforceBudgetBeforeCall(routes, {
    ceiling: 0.01,
    estimateForRoute: unknown,
    unknownPricingPolicy: 'allow',
  });
  if (allowedUnknown.length === routes.length) {
    pass('unknownPricingPolicy allow keeps unknown-priced routes viable');
  } else {
    fail('allow policy should keep all unknown routes');
  }
} catch (e) {
  fail(`route-plan tests crashed: ${e.message}`);
}
