/**
 * Core evaluation pipeline — prompt assembly, gateway completion, validation, persistence.
 */

import { assembleEvaluationPrompt } from '../llm/prompt-assembly.mjs';
import { loadEvaluationContext } from './context.mjs';
import { createEvaluationGateway } from './ledger.mjs';
import { validateEvaluationShape } from './validate.mjs';
import { parseScoreSummary } from './score-summary.mjs';
import { persistEvaluationReport } from './persist.mjs';
import { logBudgetReport } from './display.mjs';
import { resolveSourceUrl } from './source-url.mjs';
import { outputLanguageInstruction, parseOutputLanguage } from '../../profile-language.mjs';

/**
 * Build Ollama-style manual prompt (no context-budget compression).
 * Preserves legacy ollama-eval.mjs prompt shape.
 *
 * @param {object} params
 */
export function buildOllamaSystemPrompt({
  sharedContent,
  ofertaContent,
  cvContent,
  languageInstruction,
}) {
  return `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContent}

═══════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
═══════════════════════════════════════════════════════
${ofertaContent}

═══════════════════════════════════════════════════════
CANDIDATE RESUME (cv.md)
═══════════════════════════════════════════════════════
${cvContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - Block D (Comp research): use training-data salary estimates; note them as estimates.
   - Block G (Legitimacy): analyze JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. ${languageInstruction}
3. Generate Blocks A through G in full.
4. At the very end, output this exact machine-readable block:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;
}

/**
 * @typedef {Object} RunEvaluationOptions
 * @property {string} rootDir
 * @property {string} jdText
 * @property {'openai-compatible' | 'gemini'} adapterId
 * @property {string} model
 * @property {string} [baseUrl]
 * @property {string} [apiKey]
 * @property {boolean} [noCompress]
 * @property {boolean} [useBudgetCompression]
 * @property {boolean} [includeProfileMd]
 * @property {boolean} [validateShape]
 * @property {boolean} [saveReport]
 * @property {boolean} [persistReport] When false, skip report write (caller displays first).
 * @property {'hint' | 'tsv' | 'tsv-merge'} [trackerMode]
 * @property {string} [trackerNote]
 * @property {string} [toolLabel]
 * @property {string} [sourceUrl]
 * @property {string} [explicitJobUrl]
 * @property {string} [argvPostingUrl]
 * @property {number} [timeoutMs]
 * @property {boolean} [geminiUseSdk]
 * @property {ReturnType<import('./ledger.mjs').createEvaluationGateway>} [gateway]
 * @property {(msg: string) => void} [log]
 * @property {Record<string, string>} [env]
 */

/**
 * @param {RunEvaluationOptions} options
 */
export async function runEvaluation(options) {
  const {
    rootDir,
    jdText,
    adapterId,
    model,
    baseUrl,
    apiKey,
    noCompress = false,
    useBudgetCompression = true,
    includeProfileMd = adapterId === 'gemini',
    validateShape = adapterId === 'gemini',
    saveReport = true,
    persistReport = saveReport,
    trackerMode = adapterId === 'gemini' ? 'tsv-merge' : 'hint',
    trackerNote = adapterId === 'gemini' ? 'Gemini evaluation' : '',
    toolLabel,
    sourceUrl: explicitSourceUrl,
    explicitJobUrl,
    argvPostingUrl,
    timeoutMs,
    geminiUseSdk = false,
    gateway: injectedGateway,
    log = (msg) => console.log(msg),
    env = process.env,
  } = options;

  log('\n📂  Loading context files...');
  const ctx = loadEvaluationContext({ rootDir, includeProfileMd, env });

  let systemInstruction;
  let userContent;
  let budgetReport;

  if (useBudgetCompression) {
    const assembled = assembleEvaluationPrompt({
      sharedContent: ctx.sharedContent,
      ofertaContent: ctx.ofertaContent,
      cvContent: ctx.cvContent,
      profileYml: ctx.profileYml,
      profileContent: ctx.profileContent,
      jdText,
      noCompress,
      languageInstruction: ctx.languageInstruction,
      adapterId,
    });
    systemInstruction = assembled.systemInstruction;
    userContent = assembled.userContent;
    budgetReport = assembled.budgetReport;
    logBudgetReport({ budgetReport });
  } else {
    systemInstruction = buildOllamaSystemPrompt({
      sharedContent: ctx.sharedContent,
      ofertaContent: ctx.ofertaContent,
      cvContent: ctx.cvContent,
      languageInstruction: ctx.languageInstruction,
    });
    userContent = `JOB DESCRIPTION TO EVALUATE:\n\n${jdText}`;
  }

  const gateway = injectedGateway ?? createEvaluationGateway({
    rootDir,
    env,
    geminiUseSdk,
    importGeminiSdk: geminiUseSdk ? () => import('@google/generative-ai') : undefined,
  });
  const routeHints = {
    provider: adapterId,
    model,
    baseUrl,
    apiKey,
  };

  const completion = await gateway.complete({
    task: 'evaluation',
    systemInstruction,
    userContent,
    route: routeHints,
    timeoutMs,
    generation: { temperature: 0.4, maxOutputTokens: 8192 },
  });

  const evaluationText = completion.text;

  if (validateShape) {
    validateEvaluationShape(evaluationText);
  }

  const summary = parseScoreSummary(evaluationText, { multilineSafe: adapterId === 'gemini' });
  const sourceUrl = explicitSourceUrl ?? resolveSourceUrl({
    explicitUrl: explicitJobUrl,
    argvPostingUrl,
    jdText,
  });

  let persistResult = null;
  if (persistReport && saveReport) {
    const host = completion.route.endpoint?.host ?? completion.route.provider;
    const toolLine = toolLabel ?? `${adapterId === 'gemini' ? 'Gemini' : 'OpenAI-compatible'} (${model} @ ${host})`;
    persistResult = await persistEvaluationReport({
      rootDir,
      reportsDir: ctx.paths.reports,
      evaluationText,
      summary,
      toolLine,
      sourceUrl,
      trackerMode,
      trackerNote,
      trackerAdditionsDir: ctx.paths.trackerAdditions,
      mergeTrackerScript: ctx.paths.mergeTracker,
      env,
    });
  }

  return {
    evaluationText,
    summary,
    sourceUrl,
    completion,
    persistResult,
    context: ctx,
    gateway,
  };
}

/**
 * OpenRouter runner system prompt (modes concatenation, not oferta A-G assembly).
 *
 * @param {object} params
 * @param {string} params.modeContent
 * @param {object} params.ctx
 */
export function buildOpenRouterSystemPrompt(modeContent, ctx) {
  const languageInstruction = outputLanguageInstruction(parseOutputLanguage(ctx.profile));
  return [
    ctx.shared,
    ctx.profileMode,
    modeContent,
    '---',
    'CANDIDATE PROFILE (YAML):',
    ctx.profile,
    '---',
    'CV (Markdown):',
    ctx.cv,
    '---',
    'OUTPUT LANGUAGE:',
    languageInstruction,
  ].filter(Boolean).join('\n\n');
}

export { validateEvaluationShape, parseScoreSummary, persistEvaluationReport };
