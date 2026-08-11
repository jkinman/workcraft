/**
 * CV tailoring via the internal LLM gateway.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import yaml from 'js-yaml';
import { createEvaluationGateway } from './ledger.mjs';
import { assertHostedOpenAiEndpoint, parseTimeoutMs } from './guards.mjs';

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {string} params.jdPath
 * @param {string} params.reportPath
 * @param {string} params.modelName
 * @param {string} params.baseUrl
 * @param {string} params.apiKey
 */
export async function runTailoring({
  rootDir,
  jdPath,
  reportPath,
  modelName,
  baseUrl,
  apiKey,
}) {
  const paths = {
    shared: join(rootDir, 'modes', '_shared.md'),
    writing: join(rootDir, 'modes', '_writing.md'),
    pdfMode: join(rootDir, 'modes', 'pdf.md'),
    cv: join(rootDir, 'cv.md'),
    profile: join(rootDir, 'config', 'profile.yml'),
    template: join(rootDir, 'templates', 'cv-template.html'),
    output: join(rootDir, 'output'),
  };

  function readFile(path, label, required = false) {
    if (!existsSync(path)) {
      if (required) throw new Error(`Required context file not found: ${label} at ${path}`);
      console.warn(`⚠️   ${label} not found at: ${path}`);
      return `[${label} not found — skipping]`;
    }
    return readFileSync(path, 'utf-8').trim();
  }

  console.log('\\n📂  Loading context files...');

  const sharedContext = readFile(paths.shared, 'modes/_shared.md');
  const writingContext = readFile(paths.writing, 'modes/_writing.md');
  const pdfModeLogic = readFile(paths.pdfMode, 'modes/pdf.md');
  const cvContent = readFile(paths.cv, 'cv.md', true);
  const profileContent = readFile(paths.profile, 'config/profile.yml', true);
  const templateHtml = readFile(paths.template, 'templates/cv-template.html', true);

  const jdText = readFileSync(jdPath, 'utf-8').trim();
  const reportText = readFileSync(reportPath, 'utf-8').trim();

  const reportFilename = basename(reportPath);
  const match = reportFilename.match(/^\d+-([a-z0-9-]+)-\d{4}-\d{2}-\d{2}\.md$/);
  const companySlug = match ? match[1] : 'unknown-company';

  let roleSlug = 'role';
  const roleMatch = reportText.match(/^#\s+Evaluation:\s+[^-]+\s+-\s+(.+?)$/m);
  if (roleMatch?.[1]) {
    roleSlug = roleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const { host } = assertHostedOpenAiEndpoint({ baseUrl, apiKey });
  const timeoutMs = parseTimeoutMs(process.env.OPENAI_TIMEOUT_MS);

  const systemPrompt = `You are career-ops, an AI-powered CV tailoring engine.
You read a candidate's base CV, profile, an evaluation report, and a Job Description.
Your job is to apply strict anti-fabrication tailoring rules to fill in an HTML template.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContext}

═══════════════════════════════════════════════════════
WRITING GUARDRAILS (_writing.md)
═══════════════════════════════════════════════════════
${writingContext}

═══════════════════════════════════════════════════════
PDF TAILORING MODE (pdf.md)
═══════════════════════════════════════════════════════
${pdfModeLogic}

═══════════════════════════════════════════════════════
HTML TEMPLATE (cv-template.html)
═══════════════════════════════════════════════════════
${templateHtml}

═══════════════════════════════════════════════════════
CANDIDATE BASE CV & PROFILE
═══════════════════════════════════════════════════════
[cv.md]
${cvContent}

[config/profile.yml]
${profileContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. NEVER invent skills, metrics, or experience the candidate does not have.
2. Inject keywords naturally by reformulating the real experience using JD vocabulary.
3. Apply the 6-second clarity gate: strongest matching evidence first.
4. Replace all {{PLACEHOLDERS}} in the HTML Template exactly as instructed.
5. Your final output MUST be the complete, raw, tailored HTML document.
6. Do NOT include markdown formatting like \`\`\`html or conversational filler. Output the raw HTML starting with <!DOCTYPE html> and ending with </html>.`;

  console.log(`\n🔒  Privacy: your cv.md + JD will be sent to ${host}.`);
  console.log(`🤖  Calling ${modelName} via ${host}... this may take a minute.\n`);

  const gateway = createEvaluationGateway({ rootDir });
  const completion = await gateway.complete({
    task: 'tailoring',
    systemInstruction: systemPrompt,
    userContent: `EVALUATION REPORT:\n\n${reportText}\n\nJOB DESCRIPTION:\n\n${jdText}\n\nNow, generate and output the fully filled HTML CV matching the rules above. Output ONLY raw HTML.`,
    route: {
      provider: 'openai-compatible',
      model: modelName,
      baseUrl,
      apiKey,
    },
    timeoutMs,
    generation: { temperature: 0.2 },
  });

  let tailoredHtml = completion.text.replace(/^\s*```(html)?\s*/i, '').replace(/\s*```\s*$/, '');

  if (!existsSync(paths.output)) {
    mkdirSync(paths.output, { recursive: true });
  }

  let candidateName = 'candidate';
  try {
    const profile = yaml.load(profileContent);
    if (profile?.name) candidateName = profile.name;
  } catch (err) {
    console.warn(`⚠️   Failed to parse profile.yml: ${err.message}`);
  }
  candidateName = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const filename = `cv-${candidateName}-${companySlug}.html`;
  const htmlPath = join(paths.output, filename);
  writeFileSync(htmlPath, tailoredHtml, 'utf-8');
  console.log(`\n✅  Tailored HTML saved: ${htmlPath}`);

  const pdfFilename = `cv-${candidateName}-${companySlug}-${roleSlug}-${new Date().toISOString().split('T')[0]}.pdf`;
  const reportNumMatch = reportFilename.match(/^(\d+)-/);
  const reportNum = reportNumMatch ? reportNumMatch[1] : '001';
  console.log(`\n📄  Next step (generate PDF):\n    node generate-pdf.mjs output/${filename} output/${pdfFilename} --format=letter --report=${reportNum}\n`);

  return { htmlPath, completion };
}
