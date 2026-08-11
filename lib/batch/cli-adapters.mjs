/**
 * Batch worker CLI adapters — provider-neutral shell-out contract.
 */

import { execFileSync, spawnSync } from 'child_process';
import { resolveEvaluatorProvider, buildEvaluatorArgv } from '../evaluation/providers.mjs';
import { readProfile } from '../profile/index.mjs';
import { resolveCareerOpsPaths } from '../path-roots.mjs';

/** @typedef {'claude'|'codex'|'opencode'} BatchWorkerCliId */

export const BATCH_WORKER_ADAPTERS = {
  claude: {
    id: 'claude',
    command: 'claude',
    detectInstalled() {
      try {
        execFileSync('claude', ['--version'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    buildArgs({ promptFile, model, spendTier }) {
      const args = ['-p', '--dangerously-skip-permissions', '--strict-mcp-config'];
      if (model) args.push('--model', model);
      args.push('--append-system-prompt-file', promptFile, 'Process batch offer per prompt file.');
      return { command: 'claude', args };
    },
    parseUsage(_stdout, _stderr) {
      return { known: false, reason: 'Claude CLI does not expose structured token usage to batch-runner' };
    },
  },
  codex: {
    id: 'codex',
    command: 'codex',
    detectInstalled() {
      try {
        execFileSync('codex', ['--help'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    buildArgs({ promptText, model }) {
      const args = ['exec', promptText];
      if (model) args.push('--model', model);
      return { command: 'codex', args };
    },
    parseUsage(stdout) {
      const match = stdout.match(/tokens?\s*[:\s]+(\d+)/i);
      if (match) {
        return { known: true, totalTokens: Number(match[1]) };
      }
      return { known: false, reason: 'Codex exec usage format not recognized' };
    },
  },
  opencode: {
    id: 'opencode',
    command: 'opencode',
    detectInstalled() {
      try {
        execFileSync('opencode', ['--help'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    buildArgs({ promptText, model }) {
      const args = ['run', promptText];
      if (model) args.push('--model', model);
      return { command: 'opencode', args };
    },
    parseUsage(_stdout, _stderr) {
      return { known: false, reason: 'OpenCode run usage format not recognized' };
    },
  },
};

const SPEND_TIER_CLAUDE_MODEL = {
  economy: 'claude-haiku-4-5',
  standard: 'claude-sonnet-5',
  premium: 'claude-opus-5',
};

/**
 * Resolve installed worker CLI in priority order.
 *
 * @param {BatchWorkerCliId[]} [preference]
 */
export function resolveBatchWorkerAdapter(preference = ['claude', 'codex', 'opencode']) {
  for (const id of preference) {
    const adapter = BATCH_WORKER_ADAPTERS[id];
    if (adapter?.detectInstalled()) return adapter;
  }
  return null;
}

/**
 * Resolve model for batch workers from profile spend tier.
 *
 * @param {object} [options]
 * @param {string} [options.profilePath]
 * @param {string} [options.explicitModel]
 * @param {BatchWorkerCliId} [options.adapterId='claude']
 */
export function resolveBatchModel(options = {}) {
  if (options.explicitModel) {
    return { model: options.explicitModel, spendTier: null, source: 'cli-override' };
  }
  const profile = readProfile({ profilePath: options.profilePath });
  const adapterId = options.adapterId || 'claude';
  if (adapterId === 'claude') {
    return {
      model: SPEND_TIER_CLAUDE_MODEL[profile.spendTier] || SPEND_TIER_CLAUDE_MODEL.standard,
      spendTier: profile.spendTier,
      source: 'profile-spend-tier',
    };
  }
  return { model: null, spendTier: profile.spendTier, source: 'profile-spend-tier' };
}

/**
 * Provider-neutral evaluator selection reused from lib/evaluation.
 *
 * @param {object} [params]
 */
export function describeBatchEvaluation(params = {}) {
  const env = params.env || process.env;
  const rootDir = params.rootDir || resolveCareerOpsPaths().systemRoot;
  const provider = resolveEvaluatorProvider({ env });
  return {
    provider,
    argvTemplate: buildEvaluatorArgv({
      provider,
      jdFile: params.jdFile || 'batch/jd-placeholder.txt',
      noSave: true,
    }),
    rootDir,
  };
}

/**
 * Run a worker adapter safely (no shell interpolation).
 *
 * @param {BatchWorkerCliId} adapterId
 * @param {object} params
 */
export function runBatchWorker(adapterId, params) {
  const adapter = BATCH_WORKER_ADAPTERS[adapterId];
  if (!adapter) throw new Error(`Unknown batch worker adapter: ${adapterId}`);
  const built = adapter.buildArgs(params);
  const result = spawnSync(built.command, built.args, {
    cwd: params.cwd,
    encoding: 'utf8',
    input: params.stdin,
    maxBuffer: params.maxBuffer || 8 * 1024 * 1024,
  });
  const usage = adapter.parseUsage(result.stdout || '', result.stderr || '');
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    usage,
    adapterId,
  };
}
