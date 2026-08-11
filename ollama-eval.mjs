#!/usr/bin/env node
/**
 * ollama-eval.mjs — Ollama-powered Job Offer Evaluator for career-ops
 *
 * Stable root facade. Evaluation logic lives in lib/evaluation/.
 */

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runOllamaEvalCli } from './lib/evaluation/cli.mjs';
import { loadDotenvOptional } from './lib/evaluation/cli-args.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  await loadDotenvOptional();
  const code = await runOllamaEvalCli({ rootDir: ROOT, argv: process.argv });
  process.exit(code);
}
