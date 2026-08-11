/**
 * CLI entry runners for headless evaluators (import-safe; invoked by root facades).
 */

import { TokenAccumulator, formatBreakdown } from '../../utils/token-tracker.mjs';
import { runEvaluation, persistEvaluationReport } from './pipeline.mjs';
import {
  assertHostedOpenAiEndpoint,
  assertOllamaLoopback,
  parseTimeoutMs,
} from './guards.mjs';
import {
  printEvaluationHeader,
  printEvaluationFooter,
  logPersistResult,
} from './display.mjs';
import { parseCommonEvalArgs } from './cli-args.mjs';
import { resolveSourceUrl } from './source-url.mjs';

function resolveCliSourceUrl(parsed) {
  return resolveSourceUrl({
    explicitUrl: parsed.jobUrl,
    argvPostingUrl: parsed.argvPostingUrl,
    jdText: parsed.jdText,
  });
}

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {string[]} params.argv
 */
export async function runOpenAiEvalCli({ rootDir, argv }) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printOpenAiHelp();
    return 0;
  }

  const parsed = parseCommonEvalArgs(args, {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.OPENAI_API_KEY || '',
  });
  if (parsed.error) {
    console.error(parsed.error);
    return parsed.exitCode ?? 1;
  }

  let host;
  try {
    ({ host } = assertHostedOpenAiEndpoint({
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
    }));
  } catch (err) {
    console.error(`\n❌  ${err.message}`);
    return 1;
  }

  const timeoutMs = parseTimeoutMs(process.env.OPENAI_TIMEOUT_MS);
  const tracker = new TokenAccumulator();
  tracker.recordZeroToken('scan');
  tracker.recordZeroToken('pdf payload');

  console.log(`\n🔒  Privacy: your cv.md + JD will be sent to ${host}.`);
  console.log(`🤖  Calling ${parsed.modelName} via ${host}... this may take a minute.\n`);

  try {
    const result = await runEvaluation({
      rootDir,
      jdText: parsed.jdText,
      adapterId: 'openai-compatible',
      model: parsed.modelName,
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      noCompress: parsed.noCompress,
      saveReport: parsed.saveReport,
      persistReport: false,
      trackerMode: 'hint',
      timeoutMs,
    });

    tracker.record('evaluation', result.completion.usage);
    printEvaluationHeader({ title: `${parsed.modelName} (${host})`, evaluationText: result.evaluationText });

    let exitCode = 0;
    if (parsed.saveReport) {
      const hostLabel = result.completion.route.endpoint?.host ?? host;
      const persistResult = await persistEvaluationReport({
        rootDir,
        reportsDir: result.context.paths.reports,
        evaluationText: result.evaluationText,
        summary: result.summary,
        toolLine: `OpenAI-compatible (${parsed.modelName} @ ${hostLabel})`,
        sourceUrl: resolveCliSourceUrl(parsed),
        trackerMode: 'hint',
      });
      logPersistResult(persistResult, { trackerMode: 'hint' });
      exitCode = persistResult.exitCode ?? 0;
    }

    printEvaluationFooter(result.summary);
    console.log(formatBreakdown(tracker, parsed.modelName, 'openai'));
    return exitCode;
  } catch (err) {
    return handleGatewayError(err, { host, timeoutMs, provider: 'openai' });
  }
}

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {string[]} params.argv
 */
export async function runGeminiEvalCli({ rootDir, argv }) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printGeminiHelp();
    return 0;
  }

  const parsed = parseCommonEvalArgs(args, {
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  });
  if (parsed.error) {
    console.error(parsed.error);
    return parsed.exitCode ?? 1;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`
❌  GEMINI_API_KEY not found.

   1. Get a free key at https://aistudio.google.com/apikey
   2. Add it to .env:   GEMINI_API_KEY=your_key_here
   3. Or export it:     export GEMINI_API_KEY=your_key_here
`);
    return 1;
  }

  const tracker = new TokenAccumulator();
  tracker.recordZeroToken('scan');
  tracker.recordZeroToken('pdf payload');

  console.log(`🤖  Calling Gemini (${parsed.modelName})... this may take 30-60 seconds.\n`);

  try {
    const result = await runEvaluation({
      rootDir,
      jdText: parsed.jdText,
      adapterId: 'gemini',
      model: parsed.modelName,
      apiKey,
      noCompress: parsed.noCompress,
      includeProfileMd: true,
      validateShape: true,
      saveReport: parsed.saveReport,
      persistReport: false,
      trackerMode: 'tsv-merge',
      geminiUseSdk: true,
    });

    tracker.record('evaluation', result.completion.usage);
    printEvaluationHeader({ title: 'Google Gemini', evaluationText: result.evaluationText });

    if (parsed.saveReport) {
      const persistResult = await persistEvaluationReport({
        rootDir,
        reportsDir: result.context.paths.reports,
        evaluationText: result.evaluationText,
        summary: result.summary,
        toolLine: `Gemini (${parsed.modelName})`,
        sourceUrl: resolveCliSourceUrl(parsed),
        trackerMode: 'tsv-merge',
        trackerNote: 'Gemini evaluation',
        trackerAdditionsDir: result.context.paths.trackerAdditions,
        mergeTrackerScript: result.context.paths.mergeTracker,
      });
      logPersistResult(persistResult, { trackerMode: 'tsv-merge' });
      if (persistResult.exitCode) {
        printEvaluationFooter(result.summary);
        console.log(formatBreakdown(tracker, parsed.modelName, 'gemini'));
        return persistResult.exitCode;
      }
    }

    printEvaluationFooter(result.summary);
    console.log(formatBreakdown(tracker, parsed.modelName, 'gemini'));
    return 0;
  } catch (err) {
    if (err.message?.includes('Invalid career-ops report')) {
      console.error('❌  Gemini output failed validation:', err.message);
      console.error('    No report was saved. Retry, lower temperature, or use the Claude pipeline for this JD.');
      return 1;
    }
    const sanitizedMsg = (err.message || '').split(apiKey).join('[REDACTED]');
    console.error('❌  Gemini API error:', sanitizedMsg);
    if (sanitizedMsg.includes('API_KEY')) {
      console.error('    Check your GEMINI_API_KEY in .env');
    } else if (sanitizedMsg.includes('quota') || sanitizedMsg.includes('rate')) {
      console.error('    You may have hit the free-tier rate limit. Wait 60s and retry.');
    }
    return 1;
  }
}

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {string[]} params.argv
 * @param {typeof fetch} [params.fetch]
 */
export async function runOllamaEvalCli({ rootDir, argv, fetch: fetchImpl }) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printOllamaHelp();
    return 0;
  }

  const parsed = parseCommonEvalArgs(args, {
    model: process.env.OLLAMA_MODEL || 'llama3.3',
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, ''),
  });
  if (parsed.error) {
    console.error(parsed.error);
    return parsed.exitCode ?? 1;
  }

  try {
    assertOllamaLoopback({ baseUrl: parsed.baseUrl });
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;
  try {
    const probe = await fetchFn(`${parsed.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
  } catch {
    console.error(`
❌  Ollama not reachable at ${parsed.baseUrl}

   1. Install Ollama: https://ollama.com
   2. Start server:   ollama serve
   3. Pull a model:   ollama pull ${parsed.modelName}
`);
    return 1;
  }

  const timeoutMs = parseTimeoutMs(process.env.OLLAMA_TIMEOUT_MS);
  const ollamaBase = `${parsed.baseUrl}/v1`;
  const tracker = new TokenAccumulator();
  tracker.recordZeroToken('scan');
  tracker.recordZeroToken('pdf payload');

  console.log(`🤖  Calling Ollama (${parsed.modelName})... this may take a minute.\n`);

  try {
    const { createEvaluationGateway } = await import('./ledger.mjs');
    const gateway = createEvaluationGateway({ rootDir, fetch: fetchFn });

    const result = await runEvaluation({
      rootDir,
      jdText: parsed.jdText,
      adapterId: 'openai-compatible',
      model: parsed.modelName,
      baseUrl: ollamaBase,
      noCompress: true,
      useBudgetCompression: false,
      saveReport: parsed.saveReport,
      persistReport: false,
      trackerMode: 'hint',
      timeoutMs,
      gateway,
    });

    tracker.record('evaluation', result.completion.usage);
    printEvaluationHeader({ title: `Ollama (${parsed.modelName})`, evaluationText: result.evaluationText });

    if (parsed.saveReport) {
      const persistResult = await persistEvaluationReport({
        rootDir,
        reportsDir: result.context.paths.reports,
        evaluationText: result.evaluationText,
        summary: result.summary,
        toolLine: `Ollama (${parsed.modelName})`,
        sourceUrl: resolveCliSourceUrl(parsed),
        trackerMode: 'hint',
      });
      logPersistResult(persistResult, { trackerMode: 'hint' });
    }

    printEvaluationFooter(result.summary);
    console.log(formatBreakdown(tracker, parsed.modelName, 'ollama'));
    return 0;
  } catch (err) {
    return handleGatewayError(err, { timeoutMs, provider: 'ollama' });
  }
}

/**
 * @param {Error} err
 * @param {object} ctx
 */
function handleGatewayError(err, ctx) {
  if (err.name === 'TimeoutError') {
    console.error(`❌  Request timed out after ${Math.round((ctx.timeoutMs ?? 300000) / 1000)}s.`);
    console.error(`    Try a smaller/faster model, or increase timeout env.`);
    return 1;
  }
  const status = err.status ?? err.cause?.status;
  if (status) {
    console.error(`❌  API error: HTTP ${status}`);
    console.error(`    ${String(err.message ?? err).slice(0, 300)}`);
    if (status === 401 || status === 403) {
      console.error(`    → Check your API key for ${ctx.host ?? 'the provider'}.`);
    } else if (status === 404) {
      console.error(`    → Check --url (it should include any /v1 segment) and --model id.`);
    }
    return 1;
  }
  console.error(`❌  API call failed: ${err.message}`);
  return 1;
}

function printOpenAiHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║       career-ops — OpenAI-compatible Evaluator (any endpoint)     ║
╚══════════════════════════════════════════════════════════════════╝

  Evaluate a job offer with any OpenAI-compatible chat API instead of Claude.

  USAGE
    node openai-eval.mjs "<JD text>"
    node openai-eval.mjs --file ./jds/my-job.txt
    node openai-eval.mjs --url <base> --model <id> --file ./jds/job.txt

  OPTIONS
    --file <path>    Read JD from a file instead of inline text
    --model <id>     Model id            (env OPENAI_MODEL, default gpt-4o-mini)
    --url <base>     OpenAI-compatible base URL, including any /v1
                     (env OPENAI_BASE_URL, default https://api.openai.com/v1)
    --key <key>      API key             (env OPENAI_API_KEY)
    --no-save        Do not save report to reports/ directory
    --no-compress    Skip token budget compression (full context injection)
    --help           Show this help

  ENV
    OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_TIMEOUT_MS
`);
}

function printGeminiHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           career-ops — Gemini Evaluator (free-tier)             ║
╚══════════════════════════════════════════════════════════════════╝

  Evaluate a job offer using Google Gemini instead of Claude.

  USAGE
    node gemini-eval.mjs "<JD text>"
    node gemini-eval.mjs --file ./jds/my-job.txt
    node gemini-eval.mjs --model gemini-3.6-flash "<JD text>"

  OPTIONS
    --file <path>    Read JD from a file instead of inline text
    --model <name>   Gemini model to use (default: gemini-3.6-flash)
    --no-save        Do not save report to reports/ directory
    --no-compress    Skip token budget compression (full context injection)
    --help           Show this help
`);
}

function printOllamaHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           career-ops — Ollama Evaluator (local / free)          ║
╚══════════════════════════════════════════════════════════════════╝

  Evaluate a job offer using a local Ollama model instead of Claude.

  USAGE
    node ollama-eval.mjs "<JD text>"
    node ollama-eval.mjs --file ./jds/my-job.txt
    node ollama-eval.mjs --model qwen2.5:72b "<JD text>"

  OPTIONS
    --file <path>    Read JD from a file instead of inline text
    --model <name>   Ollama model to use (default: llama3.3)
    --url <url>      Ollama base URL (default: http://localhost:11434)
    --no-save        Do not save report to reports/ directory
    --help           Show this help
`);
}
