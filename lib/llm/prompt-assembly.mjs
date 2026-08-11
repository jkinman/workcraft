/**
 * Evaluation prompt assembly — reuses lib/context-budget.mjs; modes/*.md stay scoring truth.
 */

import { buildBudgetedPrompt } from '../context-budget.mjs';

/**
 * @typedef {Object} EvaluationPromptInput
 * @property {string} sharedContent
 * @property {string} ofertaContent
 * @property {string} cvContent
 * @property {string} [profileYml]
 * @property {string} [profileContent]
 * @property {string} jdText
 * @property {boolean} [noCompress]
 * @property {number} [maxTokens]
 * @property {string} [languageInstruction]
 */

const DEFAULT_MAX_TOKENS = {
  'openai-compatible': 128_000,
  gemini: 1_048_576,
};

const EVALUATOR_RULES = `1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. Generate Blocks A through G in full.
3. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---`;

/**
 * @param {EvaluationPromptInput & { adapterId?: import('./types.mjs').AdapterId }} input
 */
export function assembleEvaluationPrompt(input) {
  const adapterId = input.adapterId ?? 'openai-compatible';
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS[adapterId] ?? 128_000;
  const { contextBody, budgetReport } = buildBudgetedPrompt({
    sharedContent: input.sharedContent,
    ofertaContent: input.ofertaContent,
    cvContent: input.cvContent,
    profileYml: input.profileYml,
    profileContent: input.profileContent,
    jdText: input.jdText,
    noCompress: input.noCompress,
    maxTokens,
  });

  const languageLine = input.languageInstruction
    ? `2. ${input.languageInstruction}`
    : '';

  const rulesBlock = languageLine
    ? EVALUATOR_RULES.replace('2. Generate Blocks', `${languageLine}\n3. Generate Blocks`).replace('3. At the very end', '4. At the very end')
    : EVALUATOR_RULES;

  const systemInstruction = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

${contextBody}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
${rulesBlock}
`;

  const userContent = `JOB DESCRIPTION TO EVALUATE:\n\n${input.jdText}`;

  return {
    systemInstruction,
    userContent,
    budgetReport,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent },
    ],
  };
}

/**
 * Stable fingerprint for golden tests — ignores whitespace normalization only at line ends.
 * @param {string} text
 */
export function promptFingerprint(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

export { buildBudgetedPrompt };
