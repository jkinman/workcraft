import { pass, fail } from '../helpers.mjs';

console.log('\nseam contracts — batch CLI adapters (Claude/Codex/OpenCode)');

try {
  const { BATCH_WORKER_ADAPTERS, resolveBatchWorkerAdapter, runBatchWorker } = await import('../../lib/batch/cli-adapters.mjs');

  for (const id of ['claude', 'codex', 'opencode']) {
    const adapter = BATCH_WORKER_ADAPTERS[id];
    if (!adapter?.buildArgs || !adapter?.parseUsage) {
      fail(`Batch adapter ${id} missing buildArgs/parseUsage`);
    }
  }
  pass('Batch worker adapters define buildArgs and parseUsage for claude/codex/opencode');

  const claudeArgs = BATCH_WORKER_ADAPTERS.claude.buildArgs({
    promptFile: '/tmp/prompt.md',
    model: 'claude-sonnet-4',
  });
  if (claudeArgs.command === 'claude' && claudeArgs.args.includes('/tmp/prompt.md')) {
    pass('Claude adapter builds argv without shell interpolation');
  } else {
    fail('Claude adapter argv contract failed');
  }

  const codexArgs = BATCH_WORKER_ADAPTERS.codex.buildArgs({ promptText: 'run eval', model: 'gpt-5' });
  if (codexArgs.args[0] === 'exec' && codexArgs.args.includes('gpt-5')) {
    pass('Codex adapter builds exec argv with model flag');
  } else {
    fail('Codex adapter argv contract failed');
  }

  const opencodeArgs = BATCH_WORKER_ADAPTERS.opencode.buildArgs({ promptText: 'run eval', model: 'kimi-k2' });
  if (opencodeArgs.args[0] === 'run') pass('OpenCode adapter builds run argv');
  else fail('OpenCode adapter argv contract failed');

  // Failure contract via injectable spawn (not executing real CLIs)
  const original = BATCH_WORKER_ADAPTERS.claude.buildArgs;
  BATCH_WORKER_ADAPTERS.claude.buildArgs = () => ({ command: process.execPath, args: ['-e', 'require("node:process").exitCode=2'] });
  const failed = runBatchWorker('claude', { cwd: process.cwd() });
  BATCH_WORKER_ADAPTERS.claude.buildArgs = original;

  if (failed.exitCode !== 0 && failed.usage?.known === false) {
    pass('Batch adapter surfaces non-zero exit and unknown usage on failure');
  } else {
    fail(`Batch failure contract unexpected: ${JSON.stringify(failed)}`);
  }

  const resolved = resolveBatchWorkerAdapter(['missing-cli-xyz', 'also-missing']);
  if (resolved === null) pass('Batch adapter resolution returns null when no CLI installed');
  else fail('Expected null adapter when none installed');
} catch (e) {
  fail(`Batch CLI seam contract crashed: ${e.message}`);
}
