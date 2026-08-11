import { pass, fail } from '../helpers.mjs';
import {
  UsageLedger,
  createUsageRecord,
  createFileSink,
} from '../../lib/llm/usage-record.mjs';
import { resolveModelRoute } from '../../lib/llm/routing.mjs';

console.log('\nllm usage-record ledger tests');

try {
  const route = resolveModelRoute({ hints: { provider: 'openai-compatible' } });
  const record = createUsageRecord({
    task: 'evaluation',
    route,
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cached_tokens: 0 },
    estimatedCostUsd: 0.001,
    rateCardVersion: 'test-v1',
    latencyMs: 42,
    outcome: 'success',
    attempt: 1,
  });

  if (Object.isFrozen(record)) {
    pass('createUsageRecord returns frozen Usage Record objects');
  } else {
    fail('usage record should be frozen');
  }

  const ledger = new UsageLedger();
  const first = ledger.append(record);
  const second = ledger.append({ ...record, id: 'second-id', timestamp: record.timestamp });
  if (ledger.length === 2 && ledger.readAll()[0] === first) {
    pass('UsageLedger append-only accepts multiple records');
  } else {
    fail('ledger append failed');
  }

  ledger.freeze();
  try {
    ledger.append(record);
    fail('frozen ledger should reject append');
  } catch (err) {
    if (/frozen/i.test(err.message)) {
      pass('UsageLedger.freeze prevents further appends');
    } else {
      fail(`unexpected freeze error: ${err.message}`);
    }
  }

  const writes = [];
  const sink = createFileSink('/tmp/unused.jsonl', {
    appendFile: (_path, line) => writes.push(line),
  });
  const sinkLedger = new UsageLedger({ sink });
  sinkLedger.append(record);
  if (writes.length === 1 && writes[0].includes('"task":"evaluation"')) {
    pass('createFileSink forwards append-only JSON lines via injectable appendFile');
  } else {
    fail('file sink failed');
  }
} catch (e) {
  fail(`usage-record tests crashed: ${e.message}`);
}
