import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pass, fail } from '../helpers.mjs';
import {
  assembleEvaluationPrompt,
  promptFingerprint,
} from '../../lib/llm/prompt-assembly.mjs';

console.log('\nllm prompt assembly golden/contract tests');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(path, label) {
  if (!existsSync(path)) return `[${label} not found]`;
  return readFileSync(path, 'utf8').trim();
}

try {
  const shared = read(join(ROOT, 'modes', '_shared.md'), '_shared.md');
  const oferta = read(join(ROOT, 'modes', 'oferta.md'), 'oferta.md');
  const cv = read(join(ROOT, 'cv.md'), 'cv.md');
  const profileYml = read(join(ROOT, 'config', 'profile.yml'), 'profile.yml');
  const jd = 'Senior Backend Engineer — build APIs with Node.js';

  const first = assembleEvaluationPrompt({
    sharedContent: shared,
    ofertaContent: oferta,
    cvContent: cv,
    profileYml,
    jdText: jd,
    adapterId: 'openai-compatible',
    noCompress: true,
  });

  const second = assembleEvaluationPrompt({
    sharedContent: shared,
    ofertaContent: oferta,
    cvContent: cv,
    profileYml,
    jdText: jd,
    adapterId: 'openai-compatible',
    noCompress: true,
  });

  const fp1 = promptFingerprint(first.systemInstruction);
  const fp2 = promptFingerprint(second.systemInstruction);
  if (fp1 === fp2 && fp1.includes('SCORE_SUMMARY') && fp1.includes('Block G')) {
    pass('assembleEvaluationPrompt is stable for identical inputs (golden fingerprint)');
  } else {
    fail('prompt assembly not stable across repeated calls');
  }

  if (first.userContent.includes(jd) && first.messages.length === 2) {
    pass('assembleEvaluationPrompt returns systemInstruction, userContent, and messages');
  } else {
    fail('assembled prompt shape invalid');
  }

  const gemini = assembleEvaluationPrompt({
    sharedContent: shared,
    ofertaContent: oferta,
    cvContent: cv,
    profileYml,
    jdText: jd,
    adapterId: 'gemini',
    noCompress: true,
  });

  if (gemini.budgetReport.budget > first.budgetReport.budget) {
    pass('gemini adapter uses larger default maxTokens budget via context-budget');
  } else {
    fail('gemini budget should exceed openai-compatible default');
  }
} catch (e) {
  fail(`prompt assembly tests crashed: ${e.message}`);
}
