/**
 * Evaluation pipeline contract tests — CLI compatibility, parsing, persistence, gateway use.
 */

import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { pass, fail, ROOT, NODE } from '../helpers.mjs';
import { runOpenAiEvalCli, runGeminiEvalCli, runOllamaEvalCli } from '../../lib/evaluation/cli.mjs';
import { createFakeAdapter } from '../../lib/llm/adapters/fake.mjs';
import {
  runEvaluation,
  parseScoreSummary,
  validateEvaluationShape,
  persistEvaluationReport,
  buildSystemMessage,
  assembleEvaluationPrompt,
  promptFingerprint,
  resolveSourceUrl,
  NO_POSTING_URL_SENTINEL,
  buildEvaluationReportHeader,
  reportHeaderHasMandatoryUrlField,
  describeBatchEvaluatorSelection,
} from '../../lib/evaluation/index.mjs';
import { createEvaluationGateway } from '../../lib/evaluation/ledger.mjs';
import { resolveEvaluatorProvider, evaluatorFacadeScript } from '../../lib/evaluation/providers.mjs';

console.log('\nevaluation pipeline contract tests');

const SAMPLE_EVAL = `# Block A
## Block A — Fit

# Block B
## Block B

# Block C
## Block C

# Block D
## Block D

# Block E
## Block E

# Block F
## Block F

# Block G
## Block G

---SCORE_SUMMARY---
COMPANY: Acme Corp
ROLE: Senior Engineer
SCORE: 4.2
ARCHETYPE: backend-swe
LEGITIMACY: High Confidence
---END_SUMMARY---
`;

try {
  await import('../../lib/evaluation/index.mjs');
  pass('lib/evaluation/index.mjs is import-safe');

  const parsed = parseScoreSummary(SAMPLE_EVAL, { multilineSafe: true });
  if (parsed.company === 'Acme Corp' && parsed.score === '4.2' && parsed.archetype === 'backend-swe') {
    pass('parseScoreSummary extracts SCORE_SUMMARY fields');
  } else {
    fail(`parseScoreSummary mismatch: ${JSON.stringify(parsed)}`);
  }

  try {
    validateEvaluationShape(SAMPLE_EVAL);
    pass('validateEvaluationShape accepts complete A–G output');
  } catch (e) {
    fail(`validateEvaluationShape rejected valid sample: ${e.message}`);
  }

  try {
    validateEvaluationShape('no blocks here');
    fail('validateEvaluationShape should reject incomplete output');
  } catch {
    pass('validateEvaluationShape rejects missing blocks');
  }

  const openaiMsg = buildSystemMessage('prefix', 'api.openai.com');
  const routerMsg = buildSystemMessage('prefix', 'openrouter.ai');
  if (typeof openaiMsg.content === 'string' && Array.isArray(routerMsg.content)) {
    pass('buildSystemMessage host-gates cache_control for OpenAI vs OpenRouter');
  } else {
    fail('buildSystemMessage host gating regressed');
  }

  const shared = readFileSync(join(ROOT, 'modes', '_shared.md'), 'utf8').trim();
  const oferta = readFileSync(join(ROOT, 'modes', 'oferta.md'), 'utf8').trim();
  const cv = existsSync(join(ROOT, 'cv.md'))
    ? readFileSync(join(ROOT, 'cv.md'), 'utf8').trim()
    : '# CV\nExperience';
  const profileYml = existsSync(join(ROOT, 'config', 'profile.yml'))
    ? readFileSync(join(ROOT, 'config', 'profile.yml'), 'utf8').trim()
    : 'spend_tier: standard\n';

  const assembled = assembleEvaluationPrompt({
    sharedContent: shared,
    ofertaContent: oferta,
    cvContent: cv,
    profileYml,
    jdText: 'Backend role at Acme',
    adapterId: 'openai-compatible',
    noCompress: true,
  });
  const fp = promptFingerprint(assembled.systemInstruction);
  if (fp.includes('SCORE_SUMMARY') && fp.includes('Block G')) {
    pass('assembleEvaluationPrompt keeps modes/*.md scoring contract in system prompt');
  } else {
    fail('assembled prompt missing scoring markers');
  }

  const fake = createFakeAdapter(async () => ({
    text: SAMPLE_EVAL,
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cached_tokens: 0 },
  }));
  const gateway = createEvaluationGateway({
    rootDir: ROOT,
    enableFileSink: false,
  });
  gateway.adapters['openai-compatible'] = fake;
  gateway.adapters.gemini = fake;

  const tmpRoot = mkdtempSync(join(tmpdir(), 'eval-contract-'));
  mkdirSync(join(tmpRoot, 'modes'), { recursive: true });
  mkdirSync(join(tmpRoot, 'config'), { recursive: true });
  writeFileSync(join(tmpRoot, 'modes', '_shared.md'), shared);
  writeFileSync(join(tmpRoot, 'modes', 'oferta.md'), oferta);
  writeFileSync(join(tmpRoot, 'cv.md'), cv);
  writeFileSync(join(tmpRoot, 'config', 'profile.yml'), profileYml);

  const result = await runEvaluation({
    rootDir: tmpRoot,
    jdText: 'Backend role at Acme',
    adapterId: 'openai-compatible',
    model: 'fake-model',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    saveReport: true,
    trackerMode: 'hint',
    gateway,
    log: () => {},
  });

  if (result.completion.text.includes('Acme Corp') && existsSync(join(tmpRoot, 'reports'))) {
    pass('runEvaluation persists report via gateway fake adapter in temp workspace');
  } else {
    fail('runEvaluation did not persist report in temp workspace');
  }

  if (result.sourceUrl === NO_POSTING_URL_SENTINEL) {
    pass('runEvaluation defaults sourceUrl to local:scripted-evaluation when no posting URL');
  } else {
    fail(`runEvaluation sourceUrl expected sentinel, got ${result.sourceUrl}`);
  }

  const reportDir = join(tmpRoot, 'reports');
  const reportFile = existsSync(reportDir)
    ? readdirSync(reportDir).find((f) => f.endsWith('.md') && !f.includes('RESERVED'))
    : null;
  if (reportFile) {
    const reportBody = readFileSync(join(reportDir, reportFile), 'utf8');
    const headerEnd = reportBody.indexOf('\n---\n');
    const header = headerEnd >= 0 ? reportBody.slice(0, headerEnd) : reportBody;
    if (
      reportBody.includes(`**URL:** ${NO_POSTING_URL_SENTINEL}`)
      && reportHeaderHasMandatoryUrlField(header)
    ) {
      pass('persisted report includes **URL:** between Score and PDF');
    } else {
      fail('report header missing mandatory URL field or wrong order');
    }
  } else {
    fail('expected persisted report file in temp workspace');
  }

  const explicit = resolveSourceUrl({
    explicitUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    jdText: 'ignored',
  });
  const inferred = resolveSourceUrl({ jdText: 'URL: https://jobs.example.com/role/1\n\nJD body' });
  const sentinel = resolveSourceUrl({ jdText: 'plain pasted JD without a link' });
  if (
    explicit === 'https://boards.greenhouse.io/acme/jobs/123'
    && inferred === 'https://jobs.example.com/role/1'
    && sentinel === NO_POSTING_URL_SENTINEL
  ) {
    pass('resolveSourceUrl accepts explicit URL, infers from JD when safe, else sentinel');
  } else {
    fail(`resolveSourceUrl mismatch explicit=${explicit} inferred=${inferred} sentinel=${sentinel}`);
  }

  const header = buildEvaluationReportHeader({
    date: '2026-08-10',
    company: 'Acme',
    role: 'Engineer',
    archetype: 'swe',
    score: '4.0',
    sourceUrl: 'https://example.com/jobs/1',
    legitimacy: 'High Confidence',
    toolLine: 'test',
  });
  if (reportHeaderHasMandatoryUrlField(header)) {
    pass('buildEvaluationReportHeader keeps URL between Score and PDF');
  } else {
    fail('buildEvaluationReportHeader field order invalid');
  }

  const batchSel = describeBatchEvaluatorSelection({ env: { OPENAI_API_KEY: 'k' } });
  if (batchSel.gatewayBacked
    && batchSel.facadeScript.endsWith('-eval.mjs')
    && batchSel.argvTemplate[0].endsWith('.mjs')
  ) {
    pass('batch evaluator selection targets gateway-backed stable facade');
  } else {
    fail(`batch selection invalid: ${JSON.stringify(batchSel)}`);
  }

  const provider = resolveEvaluatorProvider({ env: { GEMINI_API_KEY: 'x' } });
  if (provider === 'gemini' && evaluatorFacadeScript(provider) === 'gemini-eval.mjs') {
    pass('resolveEvaluatorProvider selects gemini facade when only GEMINI_API_KEY is set');
  } else {
    fail(`resolveEvaluatorProvider unexpected: ${provider}`);
  }

  const facadeCliRunners = {
    'openai-eval.mjs': runOpenAiEvalCli,
    'gemini-eval.mjs': runGeminiEvalCli,
    'ollama-eval.mjs': runOllamaEvalCli,
  };
  for (const facade of ['openai-eval.mjs', 'gemini-eval.mjs', 'ollama-eval.mjs', 'openai-tailor.mjs']) {
    const help = spawnSync(NODE, [join(ROOT, facade), '--help'], { encoding: 'utf8' });
    if (help.status === 0 && help.stdout.trim().length > 0) {
      pass(`${facade} --help exits 0 with usage text`);
    } else {
      fail(`${facade} --help failed: status=${help.status} stderr=${help.stderr?.trim()}`);
    }
  }

  for (const [facade, runCli] of Object.entries(facadeCliRunners)) {
    const code = await runCli({ rootDir: ROOT, argv: ['node', facade, '--help'] });
    if (code === 0) {
      pass(`${facade} CLI runner delegates --help through lib/evaluation/cli.mjs`);
    } else {
      fail(`${facade} CLI runner --help returned ${code}`);
    }
  }

  const { buildSystemMessage: tailorBuildSystemMessage } = await import('../../openai-tailor.mjs');
  const tailorOpenAi = tailorBuildSystemMessage('prefix', 'api.openai.com');
  const tailorRouter = tailorBuildSystemMessage('prefix', 'openrouter.ai');
  if (typeof tailorOpenAi.content === 'string' && Array.isArray(tailorRouter.content)) {
    pass('openai-tailor facade exposes buildSystemMessage with host-gated cache_control');
  } else {
    fail('openai-tailor buildSystemMessage host gating regressed');
  }

  rmSync(tmpRoot, { recursive: true, force: true });
} catch (e) {
  fail(`evaluation contract tests crashed: ${e.message}`);
}
