/**
 * Shell-facing batch helpers — invoked by batch/batch-runner.sh.
 */

import { resolveCareerOpsPaths } from '../path-roots.mjs';
import {
  getBatchStatus,
  getBatchRetries,
  upsertBatchStateRow,
  summarizeBatchState,
  initBatchStateFile,
} from './state.mjs';
import { resolveBatchModel } from './cli-adapters.mjs';

function usage() {
  console.error(`Usage: node lib/batch/cli.mjs <command> [args]

Commands:
  init-state
  get-status <id>
  get-retries <id>
  upsert <id> <url> <status> <started> <completed> <report_num> <score> <error> <retries>
  summary [--json]
  spend-tier [--json]
`);
  process.exit(1);
}

async function main() {
  const paths = resolveCareerOpsPaths();
  const cmd = process.argv[2];
  const stateFile = paths.batchStatePath;
  const profilePath = paths.profilePath;

  switch (cmd) {
    case 'init-state':
      initBatchStateFile(stateFile);
      return;
    case 'get-status': {
      console.log(getBatchStatus(stateFile, process.argv[3]));
      return;
    }
    case 'get-retries': {
      console.log(getBatchRetries(stateFile, process.argv[3]));
      return;
    }
    case 'upsert': {
      const [, , , id, url, status, started, completed, reportNum, score, error, retries] = process.argv;
      await upsertBatchStateRow(stateFile, {
        id,
        url,
        status,
        started_at: started,
        completed_at: completed,
        report_num: reportNum,
        score,
        error,
        retries,
      });
      return;
    }
    case 'summary': {
      const summary = summarizeBatchState(stateFile);
      if (process.argv.includes('--json')) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(`total=${summary.total} ${Object.entries(summary.counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
      }
      return;
    }
    case 'spend-tier': {
      const resolved = resolveBatchModel({ profilePath, explicitModel: process.env.BATCH_MODEL_OVERRIDE });
      if (process.argv.includes('--json')) {
        console.log(JSON.stringify(resolved, null, 2));
      } else {
        console.log(resolved.spendTier || 'standard');
      }
      return;
    }
    default:
      usage();
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('lib/batch/cli.mjs');
if (invokedDirectly) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

export {
  getBatchStatus,
  getBatchRetries,
  upsertBatchStateRow,
  summarizeBatchState,
  resolveBatchModel,
};
