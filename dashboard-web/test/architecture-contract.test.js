import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dashboardRoot = join(repoRoot, 'dashboard-web');
const appRoot = join(dashboardRoot, 'app');

/** Root scripts that must keep stable paths (ADR 0001). */
const STABLE_ROOT_FACADES = [
  'scan.mjs',
  'merge-tracker.mjs',
  'dedup-tracker.mjs',
  'normalize-statuses.mjs',
  'set-status.mjs',
  'update-system.mjs',
  'openai-eval.mjs',
  'gemini-eval.mjs',
  'ollama-eval.mjs',
  'openrouter-runner.mjs',
  'generate-pdf.mjs',
  'check-liveness.mjs',
  'reserve-report-num.mjs'
];

/** CLI/analysis scripts allowed to run at import time (not import-safe Modules). */
const ROOT_LIB_CLI_TOOLS = new Set([
  'lib/golden-budget-analysis.mjs',
  'lib/scrapers/test-linkedin.mjs',
  'lib/evaluation/batch-select.mjs',
  'lib/tracker/cli-transition.mjs',
  'lib/batch/run-worker.mjs',
]);

const LLM_GATEWAY_DIR = join(repoRoot, 'lib', 'llm');
const EVALUATION_DIR = join(repoRoot, 'lib', 'evaluation');
const LLM_ADAPTER_PREFIX = 'lib/llm/adapters/';

const ROOT_EVALUATOR_FACADES = [
  'openai-eval.mjs',
  'gemini-eval.mjs',
  'ollama-eval.mjs',
  'openai-tailor.mjs',
  'openrouter-runner.mjs',
];

const LLM_COMPLETION_PATTERNS = [
  /chat\/completions/i,
  /@google\/generative-ai/,
  /GoogleGenerativeAI/,
  /from\s+['"]openai['"]/,
  /from\s+['"]@anthropic-ai\/sdk['"]/
];

const APP_IO_BOUNDARY = /tenant-services|repositories\//;

const APP_ENTRY_EXCLUSIONS = new Set([
  'api/health/route.js',
  'layout.jsx',
  'not-found.jsx'
]);

function walkFiles(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const filePath = join(dir, entry);
    if (statSync(filePath).isDirectory()) {
      return walkFiles(filePath, filter);
    }
    return filter(filePath) ? [filePath] : [];
  });
}

function listInternalModules() {
  const rootLib = walkFiles(join(repoRoot, 'lib'), (p) =>
    p.endsWith('.mjs') && !p.endsWith('.test.mjs')
  );
  const webLib = walkFiles(join(dashboardRoot, 'lib'), (p) =>
    p.endsWith('.js') && !p.includes('/test/')
  );
  return [...rootLib, ...webLib]
    .map((abs) => relative(repoRoot, abs))
    .filter((rel) => !ROOT_LIB_CLI_TOOLS.has(rel));
}

function listAppEntrypoints(dir = appRoot) {
  return walkFiles(dir, (p) => /[/\\](page|route)\.(js|jsx)$/.test(p));
}

function hasUnguardedTopLevelExecution(source) {
  if (/^#!\/usr\/bin\/env node/m.test(source)) return true;
  if (/^\s*main\s*\(\s*\)\s*;/m.test(source) && !/import\.meta\.url/.test(source)) {
    return true;
  }
  return false;
}

describe('architecture contracts', () => {
  it('keeps stable root entry facades at the repository root', () => {
    const missing = STABLE_ROOT_FACADES.filter(
      (name) => !existsSync(join(repoRoot, name))
    );
    expect(missing).toEqual([]);
  });

  it('keeps internal Modules import-safe without top-level CLI execution', async () => {
    const offenders = [];
    for (const rel of listInternalModules()) {
      const source = readFileSync(join(repoRoot, rel), 'utf8');
      if (hasUnguardedTopLevelExecution(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);

    await expect(import('../../lib/path-roots.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/filesystem-lock.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/profile/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/tracker/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/reports/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/documents/cv-parse.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/batch/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/context-budget.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/llm/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/evaluation/index.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/discovery/paths.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/discovery/scan-result.mjs')).resolves.toBeDefined();
    await expect(import('../../lib/discovery/ats-identity.mjs')).resolves.toBeDefined();

    const stdoutChunks = [];
    const stderrChunks = [];
    const origStdout = process.stdout.write.bind(process.stdout);
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk, ...rest) => { stdoutChunks.push(String(chunk)); return true; };
    process.stderr.write = (chunk, ...rest) => { stderrChunks.push(String(chunk)); return true; };
    try {
      await expect(import('../../lib/discovery/index.mjs')).resolves.toBeDefined();
    } finally {
      process.stdout.write = origStdout;
      process.stderr.write = origStderr;
    }
    expect(stdoutChunks.join('')).toBe('');
    expect(stderrChunks.join('')).toBe('');
  });

  it('keeps root evaluator facades free of direct provider SDK/HTTP calls', () => {
    const offenders = [];
    for (const name of ROOT_EVALUATOR_FACADES) {
      const source = readFileSync(join(repoRoot, name), 'utf8');
      if (LLM_COMPLETION_PATTERNS.some((re) => re.test(source))) {
        offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('confines LLM completion calls to lib/llm adapters once the gateway exists', () => {
    if (!existsSync(LLM_GATEWAY_DIR)) {
      expect(existsSync(LLM_GATEWAY_DIR)).toBe(false);
      return;
    }

    const scanRoots = [
      join(repoRoot, 'lib'),
      join(dashboardRoot, 'lib'),
    ];
    const offenders = [];
    for (const root of scanRoots) {
      for (const abs of walkFiles(root, (p) => p.endsWith('.mjs') || p.endsWith('.js'))) {
        const rel = relative(repoRoot, abs).replace(/\\/g, '/');
        if (rel.startsWith(LLM_ADAPTER_PREFIX)) continue;
        if (rel.startsWith('lib/evaluation/')) continue;
        if (ROOT_LIB_CLI_TOOLS.has(rel)) continue;

        const source = readFileSync(abs, 'utf8');
        if (LLM_COMPLETION_PATTERNS.some((re) => re.test(source))) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('routes dashboard entrypoints through tenant-services or repositories for tenant I/O', () => {
    const offenders = listAppEntrypoints()
      .filter((filePath) => !APP_ENTRY_EXCLUSIONS.has(relative(appRoot, filePath)))
      .filter((filePath) => !APP_IO_BOUNDARY.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(dashboardRoot, filePath));

    expect(offenders).toEqual([]);
  });
});
