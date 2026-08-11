#!/usr/bin/env node
/**
 * Batch-facing evaluator selection CLI — prints provider-neutral facade choice.
 */

import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { describeBatchEvaluatorSelection } from './providers.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const jsonMode = process.argv.includes('--json');
  const selection = describeBatchEvaluatorSelection({ rootDir: ROOT });

  if (jsonMode) {
    console.log(JSON.stringify(selection, null, 2));
  } else {
    console.log(`batch evaluator: ${selection.provider} → ${selection.facadeScript} (gateway-backed facade)`);
    console.log(`override: CAREER_OPS_EVAL_PROVIDER=${selection.provider}`);
  }
}

export { describeBatchEvaluatorSelection };
