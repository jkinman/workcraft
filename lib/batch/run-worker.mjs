/**
 * Batch worker runner CLI — invoked by batch/batch-runner.sh.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { resolveBatchWorkerAdapter, runBatchWorker, resolveBatchModel } from './cli-adapters.mjs';
import { resolveCareerOpsPaths } from '../path-roots.mjs';

function usage() {
  console.error(`Usage: node lib/batch/run-worker.mjs --prompt-file PATH --log-file PATH [options]

Options:
  --adapter ID       claude | codex | opencode (default: env CAREER_OPS_BATCH_ADAPTER or claude)
  --prompt-file PATH Resolved prompt markdown path (Claude) or ignored for codex/opencode
  --prompt-text TEXT Inline prompt (codex/opencode)
  --log-file PATH    Worker stdout/stderr destination
  --model NAME       Explicit model override
  --dry-run          Print argv only, do not execute
  --json             JSON result on stdout
`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    adapter: process.env.CAREER_OPS_BATCH_ADAPTER || 'claude',
    promptFile: '',
    promptText: '',
    logFile: '',
    model: process.env.BATCH_MODEL_OVERRIDE || '',
    dryRun: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--adapter') opts.adapter = argv[++i];
    else if (a === '--prompt-file') opts.promptFile = argv[++i];
    else if (a === '--prompt-text') opts.promptText = argv[++i];
    else if (a === '--log-file') opts.logFile = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else usage();
  }
  if (!opts.logFile) usage();
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const paths = resolveCareerOpsPaths();
  const modelInfo = resolveBatchModel({
    profilePath: paths.profilePath,
    explicitModel: opts.model || undefined,
    adapterId: opts.adapter,
  });

  let promptText = opts.promptText;
  if (!promptText && opts.promptFile) {
    promptText = readFileSync(opts.promptFile, 'utf8');
  }

  const params = {
    cwd: paths.systemRoot,
    promptFile: opts.promptFile,
    promptText,
    model: opts.model || modelInfo.model,
    spendTier: modelInfo.spendTier,
  };

  if (opts.dryRun) {
    const adapter = resolveBatchWorkerAdapter([opts.adapter, 'claude', 'codex', 'opencode']);
    const built = adapter.buildArgs(params);
    const payload = {
      dryRun: true,
      adapterId: adapter.id,
      command: built.command,
      args: built.args,
      usage: { known: false, reason: 'dry-run' },
    };
    if (opts.json) console.log(JSON.stringify(payload, null, 2));
    else console.log(`${built.command} ${built.args.join(' ')}`);
    return;
  }

  const result = runBatchWorker(opts.adapter, params);
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(opts.logFile, output, 'utf8');

  const payload = {
    exitCode: result.exitCode,
    adapterId: result.adapterId,
    usage: result.usage,
  };
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
  process.exit(result.exitCode);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { parseArgs };
