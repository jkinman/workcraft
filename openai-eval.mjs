#!/usr/bin/env node
/**
 * openai-eval.mjs — OpenAI-compatible Job Offer Evaluator for career-ops
 *
 * Stable root facade. Evaluation logic lives in lib/evaluation/.
 */

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runOpenAiEvalCli } from './lib/evaluation/cli.mjs';
import { loadDotenvOptional } from './lib/evaluation/cli-args.mjs';

export { buildSystemMessage } from './lib/evaluation/index.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  await loadDotenvOptional();
  const code = await runOpenAiEvalCli({ rootDir: ROOT, argv: process.argv });
  process.exit(code);
}
