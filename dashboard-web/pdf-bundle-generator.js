// pdf-bundle-generator.js - All three PDF outputs: Resume, Cover Letter, Eval Report
// Terminal aesthetic: Catppuccin Mocha, sharp corners, Space fonts

const fs = require('fs');
const path = require('path');
const playwright = require('playwright');
const CONFIG = require('./config');
const { parseCV, parseCVContent } = require('./cv-parser');
const { renderMarkdownToHtml } = require('./report-parser');
const { LOGO_BASE64 } = require('./logo-base64');

// ─── SHARED UTILS ───────────────────────────────────────────────────────────

function defaultProfile() {
  return {
    full_name: 'Career-Ops Candidate',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio_url: '',
    github: ''
  };
}

function parseProfileContent(content) {
  const defaultProfile = {
    full_name: 'Career-Ops Candidate',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio_url: '',
    github: ''
  };
  const profile = { ...defaultProfile };
  const candidateMatch = content.match(/candidate:\s*\n((?:\s+\w+:\s*.*\n)+)/);
  if (candidateMatch) {
    const section = candidateMatch[1];
    const extract = (key) => {
      const m = section.match(new RegExp(`${key}:\s*"?([^"\n]+)"?`));
      return m ? m[1].trim() : null;
    };
    profile.full_name = extract('full_name') || profile.full_name;
    profile.email = extract('email') || profile.email;
    profile.phone = extract('phone') || profile.phone;
    profile.location = extract('location') || profile.location;
    profile.linkedin = extract('linkedin') || profile.linkedin;
    profile.portfolio_url = extract('portfolio_url') || profile.portfolio_url;
    profile.github = extract('github') || profile.github;
  }
  return profile;
}

function loadProfile(dataClient) {
  if (dataClient) {
    const content = dataClient.readProfile();
    return content ? parseProfileContent(content) : defaultProfile();
  }

  const profilePath = path.join(CONFIG.CAREER_OPS_PATH, 'config', 'profile.yml');
  if (!fs.existsSync(profilePath)) return defaultProfile();
  return parseProfileContent(fs.readFileSync(profilePath, 'utf8'));
}

function loadCv(dataClient) {
  if (dataClient) {
    const content = dataClient.readCv();
    if (!content) throw new Error('cv.md not found for tenant');
    return parseCVContent(content);
  }
  return parseCV();
}

function detectFormat(text) {
  const usCanadaTerms = ['usa', 'us', 'canada', 'american', 'united states', 'toronto', 'vancouver', 'sf', 'nyc', 'san francisco', 'new york'];
  const lower = (text || '').toLowerCase();
  for (const term of usCanadaTerms) {
    if (lower.includes(term)) return { format: 'letter', width: '8.5in', height: '11in' };
  }
  return { format: 'a4', width: '210mm', height: '297mm' };
}

function extractKeywords(jobDescription) {
  const techKeywords = [
    'React', 'Next.js', 'TypeScript', 'Vue', 'Node', 'Express', 'Python',
    'AI', 'ML', 'LLM', 'LangChain', 'OpenAI', 'Claude', 'RAG',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST',
    'FDE', 'Forward Deployed', 'Solutions Engineer', 'Agentic',
    'Full Stack', 'Frontend', 'Backend', 'DevOps', 'MLOps'
  ];
  const softKeywords = ['leadership', 'communication', 'stakeholder management', 'cross-functional', 'mentoring', 'architecture'];
  const found = [];
  const jdLower = (jobDescription || '').toLowerCase();
  for (const k of [...techKeywords, ...softKeywords]) {
    if (jdLower.includes(k.toLowerCase())) found.push(k);
  }
  return found.slice(0, 8);
}

async function htmlToPDF(html, outputPath, format) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPath,
    format: format.format === 'letter' ? 'Letter' : 'A4',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });
  await browser.close();
  return outputPath;
}

async function htmlToPDFBuffer(html, format) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buffer = await page.pdf({
    format: format.format === 'letter' ? 'Letter' : 'A4',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });
  await browser.close();
  return buffer;
}

async function writePDFOutput(html, filename, format, dataClient) {
  if (dataClient) {
    const buffer = await htmlToPDFBuffer(html, format);
    dataClient.writeOutputFile(filename, buffer);
    return dataClient.resolveOutputPath(filename);
  }

  const outputPath = path.join(ensureOutputDir(), filename);
  await htmlToPDF(html, outputPath, format);
  return outputPath;
}

function makeFilename(type, company, profile = {}) {
  const date = new Date().toISOString().split('T')[0];
  const candidateSlug = (profile.full_name || 'candidate').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const companySlug = company.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${type}-${candidateSlug}-${companySlug}-${date}.pdf`;
}

function ensureOutputDir(dataClient) {
  if (dataClient) return dataClient.ensureOutputDir();

  const dir = path.join(CONFIG.CAREER_OPS_PATH, 'output');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── TERMINAL THEME CSS (shared across all PDFs) ────────────────────────────

function terminalPDFStyles() {
  return `
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

:root {
  --bg: #121221;
  --bg-alt: #1a1a2a;
  --bg-card: #1e1e2e;
  --border: #313244;
  --border-light: #45464f;
  --text: #e3e0f7;
  --text-muted: #c6c5d1;
  --text-dim: #90909a;
  --primary: #d8dbff;
  --primary-dim: #bac3ff;
  --success: #99d595;
  --warning: #f9e2af;
  --error: #ffb4ab;
  --pink: #ffd2dc;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
}

.page {
  padding: 0.4in;
}

/* Header */
.doc-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.doc-header .logo {
  height: 48px;
  width: auto;
  flex-shrink: 0;
}

.doc-header h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.doc-header .tagline {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 8px;
  line-height: 1.4;
}

.doc-header .contact-row {
  font-size: 9px;
  color: var(--text-dim);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.doc-header .contact-row a {
  color: var(--primary-dim);
  text-decoration: none;
}

/* Section titles */
.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--border);
}

.section-title::before {
  content: '## ';
  color: var(--primary-dim);
}

/* Summary */
.summary-text {
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Competency tags */
.competency-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.competency-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border: 1px solid var(--border);
  color: var(--text-muted);
  background: var(--bg-alt);
}

.competency-tag.highlight {
  border-color: var(--success);
  color: var(--success);
  background: rgba(153,213,149,0.08);
}

/* Experience */
.job {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border);
}

.job:last-child {
  border-bottom: none;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.job-company {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
}

.job-date {
  font-size: 9px;
  color: var(--text-dim);
}

.job-role {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.job-desc {
  font-size: 9px;
  color: var(--text-dim);
  font-style: italic;
  margin-bottom: 4px;
  line-height: 1.4;
}

.job-bullets {
  margin-left: 14px;
  font-size: 9.5px;
  color: var(--text-muted);
}

.job-bullets li {
  margin-bottom: 2px;
  line-height: 1.4;
}

.job-tech {
  font-size: 8.5px;
  color: var(--primary-dim);
  margin-top: 4px;
  letter-spacing: 0.02em;
}

/* Skills */
.skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.skill-category {
  font-size: 9px;
}

.skill-category-name {
  font-weight: 700;
  color: var(--primary-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
}

.skill-items {
  color: var(--text-muted);
  line-height: 1.4;
}

/* Strengths */
.strengths-list {
  list-style: none;
  padding: 0;
}

.strengths-list li {
  font-size: 9.5px;
  color: var(--text-muted);
  padding: 3px 0;
  padding-left: 14px;
  position: relative;
  line-height: 1.4;
}

.strengths-list li::before {
  content: '>';
  position: absolute;
  left: 0;
  color: var(--success);
  font-weight: 700;
}

/* Cover letter specific */
.letter-date {
  font-size: 9px;
  color: var(--text-dim);
  margin-bottom: 12px;
}

.letter-recipient {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 12px;
  line-height: 1.5;
}

.letter-salutation {
  font-size: 10px;
  color: var(--text);
  margin-bottom: 10px;
}

.letter-body {
  font-size: 10px;
  line-height: 1.7;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-align: justify;
}

.letter-closing {
  margin-top: 16px;
}

.letter-signature {
  font-size: 10px;
  color: var(--text);
  margin-top: 8px;
  line-height: 1.5;
}

/* Eval report specific */
.eval-header {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  padding: 12px;
  margin-bottom: 12px;
}

.eval-score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.eval-score {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--success);
}

.eval-verdict {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 6px 12px;
  border: 1px solid var(--success);
  color: var(--success);
  background: rgba(153,213,149,0.08);
}

.eval-verdict.skip {
  border-color: var(--error);
  color: var(--error);
  background: rgba(255,180,171,0.08);
}

.eval-verdict.strong {
  border-color: var(--warning);
  color: var(--warning);
  background: rgba(249,226,175,0.08);
}

.eval-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 9px;
  color: var(--text-dim);
}

.eval-meta-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  font-size: 8px;
}

/* Report body (rendered markdown) */
.report-body {
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--text-muted);
}

.report-body h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--primary);
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--border);
}

.report-body h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 12px 0 6px;
}

.report-body h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  margin: 10px 0 4px;
}

.report-body p {
  margin: 6px 0;
}

.report-body ul, .report-body ol {
  margin: 6px 0;
  padding-left: 16px;
}

.report-body li {
  margin: 3px 0;
}

.report-body strong {
  color: var(--text);
  font-weight: 700;
}

.report-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 9px;
}

.report-body th {
  text-align: left;
  padding: 6px;
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 8px;
  letter-spacing: 0.05em;
}

.report-body td {
  padding: 6px;
  border-bottom: 1px dashed var(--border);
}

.report-body blockquote {
  border-left: 2px solid var(--primary-dim);
  margin: 8px 0;
  padding: 6px 12px;
  background: var(--bg-alt);
}

.report-body code {
  background: var(--bg-alt);
  padding: 1px 4px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  color: var(--primary-dim);
  border: 1px solid var(--border);
}

.report-body pre {
  background: var(--bg-alt);
  padding: 8px;
  border: 1px solid var(--border);
  overflow-x: auto;
  margin: 8px 0;
}

.report-body pre code {
  background: transparent;
  border: none;
  padding: 0;
}

.report-body a {
  color: var(--primary-dim);
  text-decoration: underline;
}

.report-body hr {
  border: none;
  border-top: 1px dashed var(--border);
  margin: 12px 0;
}

/* Page break */
.page-break {
  page-break-after: always;
}

/* Footer */
.doc-footer {
  margin-top: 16px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
  font-size: 8px;
  color: var(--text-dim);
  text-align: center;
}
</style>
  `;
}

// ─── 1. RESUME/CV PDF ───────────────────────────────────────────────────────

function buildResumeHTML(cv, profile, keywords, company, role, format) {
  const matchedKeywords = new Set(keywords.map(k => k.toLowerCase()));

  // Tailor summary
  let summary = cv.summary;
  if ((matchedKeywords.has('ai') || matchedKeywords.has('llm')) && !summary.includes('AI')) {
    summary = summary.replace('practical AI integration', 'AI, LLM-powered workflows, and practical AI integration');
  }
  if (matchedKeywords.has('react') || matchedKeywords.has('next.js')) {
    summary = summary.replace('React experience', 'React, Next.js, TypeScript with modern frontend architecture');
  }
  if (summary.length < 350) {
    summary += ` Seeking to bring 20+ years of engineering expertise to ${company} as ${role}.`;
  }

  // Aggregate the per-job technologies as a fallback when the dedicated Skills
  // section is empty (common after a fresh resume import).
  const experienceTech = [];
  for (const exp of cv.experience) {
    for (const tech of exp.technologies || []) {
      if (!experienceTech.includes(tech)) experienceTech.push(tech);
    }
  }

  // Competencies
  const allSkills = [
    ...cv.skills.frontend, ...cv.skills.backend, ...cv.skills.cloud,
    ...cv.skills.data, ...cv.skills.architecture
  ];
  const competencyItems = (allSkills.length ? allSkills : experienceTech).slice(0, 16);
  const competenciesHtml = competencyItems.map(k => {
    const isHighlight = matchedKeywords.has(k.toLowerCase());
    return `<span class="competency-tag ${isHighlight ? 'highlight' : ''}">${k}</span>`;
  }).join('');

  // Experience — render every achievement plus the recovered tech stack.
  const experienceHtml = cv.experience.map(exp => {
    const bullets = (exp.highlights || []).map(h => `<li>${h}</li>`).join('');
    const tech = (exp.technologies || []).length
      ? `<div class="job-tech">${exp.technologies.join(' · ')}</div>`
      : '';
    return `
    <div class="job">
      <div class="job-header">
        <span class="job-company">${exp.company}</span>
        <span class="job-date">${exp.date}</span>
      </div>
      <div class="job-role">${exp.role}</div>
      ${exp.description ? `<div class="job-desc">${exp.description}</div>` : ''}
      ${bullets ? `<ul class="job-bullets">${bullets}</ul>` : ''}
      ${tech}
    </div>`;
  }).join('');

  // Skills grid — fall back to aggregated experience tech when empty.
  let skillsHtml = Object.entries(cv.skills)
    .filter(([_, items]) => items.length > 0)
    .map(([cat, items]) => `
      <div class="skill-category">
        <div class="skill-category-name">${cat}</div>
        <div class="skill-items">${items.join(' • ')}</div>
      </div>
    `).join('');
  if (!skillsHtml && experienceTech.length) {
    skillsHtml = `
      <div class="skill-category">
        <div class="skill-category-name">Technologies</div>
        <div class="skill-items">${experienceTech.join(' • ')}</div>
      </div>`;
  }

  // Strengths
  const strengthsHtml = cv.strengths.slice(0, 5).map(s => `<li>${s}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${profile.full_name} — CV</title>
${terminalPDFStyles()}
</head>
<body>
<div class="page">
  <div class="doc-header">
    <img src="${LOGO_BASE64}" class="logo" alt="Angry Mob">
    <div>
      <h1>${profile.full_name}</h1>
      <div class="tagline">${cv.tagline}</div>
      <div class="contact-row">
        ${profile.location} | ${profile.email} | ${profile.phone} | ${profile.linkedin} | ${profile.portfolio_url}
      </div>
    </div>
  </div>

  <div class="section-title">Professional Summary</div>
  <div class="summary-text">${summary}</div>

  <div class="section-title">Core Competencies</div>
  <div class="competency-grid">${competenciesHtml}</div>

  <div class="section-title">Experience</div>
  ${experienceHtml}

  <div class="section-title">Technical Skills</div>
  <div class="skills-grid">${skillsHtml}</div>

  <div class="section-title">Key Strengths</div>
  <ul class="strengths-list">${strengthsHtml}</ul>

  <div class="doc-footer">
    Generated by Career-Ops Assistant // ${company} — ${role} // ${new Date().toLocaleDateString()}
  </div>
</div>
</body>
</html>`;
}

// ─── 2. COVER LETTER PDF ────────────────────────────────────────────────────

function generateHook(company, role, jobDescription) {
  const jdLower = (jobDescription || '').toLowerCase();
  if (jdLower.includes('ai') || jdLower.includes('llm') || jdLower.includes('ml')) {
    return `I've been building LLM-powered workflows and AI-native features in production at Highspot, and I'm excited about ${company}'s approach to ${role}.`;
  }
  if (jdLower.includes('forward deployed') || jdLower.includes('fde') || jdLower.includes('solutions')) {
    return `My experience bridging technical implementation with customer success at Highspot aligns well with ${company}'s Forward Deployed Engineer model.`;
  }
  if (jdLower.includes('full stack') || jdLower.includes('fullstack')) {
    return `With 20 years shipping end-to-end—from AAA games to cloud platforms—I thrive in full-stack roles like this ${role} position.`;
  }
  return `With 20 years of engineering experience spanning AAA games to AI-powered cloud platforms, I'm excited about the ${role} opportunity at ${company}.`;
}

function buildCoverLetterHTML(cv, profile, company, role, jobDescription, format) {
  const hook = generateHook(company, role, jobDescription);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Select relevant experience
  const relevantExp = cv.experience.slice(0, 2).map(exp => {
    const highlight = exp.highlights[0] || exp.description;
    return `At ${exp.company}, ${highlight.charAt(0).toLowerCase() + highlight.slice(1)}`;
  }).join(' ');

  // Skills bridge
  const allSkills = [...cv.skills.frontend, ...cv.skills.backend, ...cv.skills.cloud];
  const jdLower = (jobDescription || '').toLowerCase();
  const matched = allSkills.filter(s => jdLower.includes(s.toLowerCase())).slice(0, 4);
  const skillsBridge = matched.length > 0
    ? `My experience with ${matched.join(', ')} directly aligns with your tech stack, and I've consistently delivered production systems at scale.`
    : `My core stack includes ${allSkills.slice(0, 4).join(', ')}, and I'm quick to adapt to new technologies.`;

  const bodyParagraphs = [
    hook,
    relevantExp,
    skillsBridge,
    `I'm particularly drawn to ${company} because of your reputation for technical excellence. The ${role} role represents exactly the kind of high-impact work I want to be doing next—building systems that solve real problems.`,
    `I'd welcome the opportunity to discuss how my background in ${cv.experience[0]?.role || 'engineering'} and ${cv.experience[1]?.role || 'product development'} could contribute to ${company}'s goals.`
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cover Letter — ${company}</title>
${terminalPDFStyles()}
</head>
<body>
<div class="page">
  <div class="doc-header">
    <img src="${LOGO_BASE64}" class="logo" alt="Angry Mob">
    <div>
      <h1>${profile.full_name}</h1>
      <div class="contact-row">
        ${profile.email} | ${profile.phone} | ${profile.linkedin} | ${profile.portfolio_url}
      </div>
    </div>
  </div>

  <div class="letter-date">${today}</div>

  <div class="letter-recipient">
    <div>Hiring Team</div>
    <div>${company}</div>
    <div>Re: ${role}</div>
  </div>

  <div class="letter-salutation">Dear ${company} Hiring Team,</div>

  ${bodyParagraphs.map(p => `<div class="letter-body">${p}</div>`).join('')}

  <div class="letter-closing">
    <div class="letter-body">Best regards,</div>
    <div class="letter-signature">
      ${profile.full_name}<br>
      ${profile.email}<br>
      ${profile.linkedin}
    </div>
  </div>

  <div class="doc-footer">
    Generated by Career-Ops Assistant // ${company} — ${role} // ${today}
  </div>
</div>
</body>
</html>`;
}

// ─── 3. EVALUATION REPORT PDF ───────────────────────────────────────────────

function filterClientFacingMarkdown(markdown) {
  if (!markdown) return '';
  
  const lines = markdown.split('\n');
  const filtered = [];
  let skipSection = false;
  let skipDepth = 0;
  
  // Sections to remove (client-facing inappropriate)
  const skipHeaders = [
    '## c) level and strategy',
    '## c) leveling path',
    '## c) level',
    '## c) strategy',
    '## f) interview prep',
    '## f) interview stories',
    '## f) interview',
    '## h) draft application answers',
    '## h) application answers',
    '## h) draft',
    '## personalization plan',
    '## e) personalization',
    '## extracted keywords',
    '## score breakdown',
    '## final recommendation',
    '### gaps',
    '### "sell senior without lying"',
    '### "if downleveled"',
    '### recommended case study',
    '### red-flag questions',
    '### star+r stories',
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().trim();
    
    // Check if this line starts a section we should skip
    const isSkipHeader = skipHeaders.some(h => lower.startsWith(h));
    
    if (isSkipHeader) {
      skipSection = true;
      // Calculate depth based on header level
      const match = line.match(/^(#{2,4})\s/);
      skipDepth = match ? match[1].length : 2;
      continue;
    }
    
    // Check if we've hit a new section at same or higher level
    if (skipSection) {
      const newHeaderMatch = line.match(/^(#{2,4})\s/);
      if (newHeaderMatch) {
        const newDepth = newHeaderMatch[1].length;
        if (newDepth <= skipDepth) {
          skipSection = false;
          skipDepth = 0;
        } else {
          continue;
        }
      } else if (line.startsWith('---')) {
        skipSection = false;
        skipDepth = 0;
        continue;
      } else if (skipSection) {
        continue;
      }
    }
    
    filtered.push(line);
  }
  
  return filtered.join('\n');
}

function buildEvalReportHTML(job, rawMarkdown, format) {
  // Filter for client-facing version
  const clientMarkdown = filterClientFacingMarkdown(rawMarkdown);
  const renderedReport = renderMarkdownToHtml(clientMarkdown || '');
  const scorePercent = Math.round((job.score / 5) * 100);
  const filled = Math.round((job.score / 5) * 10);
  const empty = 10 - filled;
  const progressBar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${scorePercent}%`;

  const verdictClass = job.verdict?.includes('APPLY') ? '' :
                       job.verdict?.includes('SKIP') ? 'skip' :
                       job.verdict?.includes('STRONG') ? 'strong' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Job Analysis — ${job.company}</title>
${terminalPDFStyles()}
</head>
<body>
<div class="page">
  <div class="doc-header">
    <img src="${LOGO_BASE64}" class="logo" alt="Angry Mob">
    <div>
      <h1>Job Analysis Report</h1>
      <div class="contact-row">
        Generated by Career-Ops Assistant // ${new Date().toLocaleDateString()}
      </div>
    </div>
  </div>

  <div class="eval-header">
    <div class="eval-score-row">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:var(--text);">${job.role}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">@${job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
        ${job.archetype ? `<div style="font-size:9px;color:var(--primary-dim);margin-top:2px;">${job.archetype}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="eval-score">${job.score}/5.0</div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-dim);margin-top:2px;">${progressBar}</div>
      </div>
    </div>
    <div class="eval-verdict ${verdictClass}">${job.verdict || 'EVALUATE'}</div>
    <div class="eval-meta">
      <div>
        <div class="eval-meta-label">Compensation</div>
        <div>${job.comp || 'Not specified'}</div>
      </div>
      <div>
        <div class="eval-meta-label">Location</div>
        <div>${job.location || 'Not specified'}</div>
      </div>
      <div>
        <div class="eval-meta-label">Date</div>
        <div>${job.date || new Date().toLocaleDateString()}</div>
      </div>
      <div>
        <div class="eval-meta-label">Source</div>
        <div>${job.source || 'Unknown'}</div>
      </div>
    </div>
  </div>

  <div class="section-title">Analysis</div>
  <div class="report-body">${renderedReport}</div>

  <div class="doc-footer">
    Career-Ops Assistant // Score: ${job.score}/5.0 // ${job.company}
  </div>
</div>
</body>
</html>`;
}

function buildFullEvalReportHTML(job, rawMarkdown, format) {
  const renderedReport = renderMarkdownToHtml(rawMarkdown || '');
  const scorePercent = Math.round((job.score / 5) * 100);
  const filled = Math.round((job.score / 5) * 10);
  const empty = 10 - filled;
  const progressBar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${scorePercent}%`;

  const verdictClass = job.verdict?.includes('APPLY') ? '' :
                       job.verdict?.includes('SKIP') ? 'skip' :
                       job.verdict?.includes('STRONG') ? 'strong' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Full Eval — ${job.company}</title>
${terminalPDFStyles()}
</head>
<body>
<div class="page">
  <div class="doc-header">
    <img src="${LOGO_BASE64}" class="logo" alt="Angry Mob">
    <div>
      <h1>~/career-ops/eval/${job.company?.toLowerCase().replace(/\s+/g, '-')}</h1>
      <div class="contact-row">
        Generated by Career-Ops Assistant // ${new Date().toLocaleDateString()} // CONFIDENTIAL
      </div>
    </div>
  </div>

  <div class="eval-header">
    <div class="eval-score-row">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:var(--text);">${job.role}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">@${job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
        ${job.archetype ? `<div style="font-size:9px;color:var(--primary-dim);margin-top:2px;">${job.archetype}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="eval-score">${job.score}/5.0</div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-dim);margin-top:2px;">${progressBar}</div>
      </div>
    </div>
    <div class="eval-verdict ${verdictClass}">${job.verdict || 'EVALUATE'}</div>
    <div class="eval-meta">
      <div>
        <div class="eval-meta-label">Compensation</div>
        <div>${job.comp || 'Not specified'}</div>
      </div>
      <div>
        <div class="eval-meta-label">Location</div>
        <div>${job.location || 'Not specified'}</div>
      </div>
      <div>
        <div class="eval-meta-label">Date</div>
        <div>${job.date || new Date().toLocaleDateString()}</div>
      </div>
      <div>
        <div class="eval-meta-label">Source</div>
        <div>${job.source || 'Unknown'}</div>
      </div>
    </div>
  </div>

  <div class="section-title">Full Evaluation Report</div>
  <div class="report-body">${renderedReport}</div>

  <div class="doc-footer">
    Career-Ops Assistant // Score: ${job.score}/5.0 // Verdict: ${job.verdict || 'PENDING'}
  </div>
</div>
</body>
</html>`;
}

async function generateFullEvalReportPDF(job, rawMarkdown, options = {}) {
  try {
    const { dataClient } = options;
    const profile = loadProfile(dataClient);
    const format = detectFormat(job.location + ' ' + job.company);

    const html = buildFullEvalReportHTML(job, rawMarkdown, format);
    const filename = makeFilename('full-eval', job.company, profile);
    const outputPath = await writePDFOutput(html, filename, format, dataClient);

    return {
      success: true,
      filename,
      path: outputPath,
      downloadUrl: `/download-pdf?file=${encodeURIComponent(filename)}`,
      type: 'full-eval',
      company: job.company,
      role: job.role
    };
  } catch (error) {
    console.error('Full Eval Report PDF Error:', error);
    return { success: false, error: error.message, type: 'full-eval' };
  }
}

// ─── MAIN EXPORT FUNCTIONS ──────────────────────────────────────────────────

async function generateResumePDF(company, role, jobDescription, options = {}) {
  try {
    const { dataClient } = options;
    const cv = loadCv(dataClient);
    const profile = loadProfile(dataClient);
    const keywords = extractKeywords(jobDescription);
    const format = detectFormat(jobDescription + ' ' + company);

    const html = buildResumeHTML(cv, profile, keywords, company, role, format);
    const filename = makeFilename('cv', company, profile);
    const outputPath = await writePDFOutput(html, filename, format, dataClient);

    return {
      success: true,
      filename,
      path: outputPath,
      downloadUrl: `/download-pdf?file=${encodeURIComponent(filename)}`,
      type: 'resume',
      company,
      role
    };
  } catch (error) {
    console.error('Resume PDF Error:', error);
    return { success: false, error: error.message, type: 'resume' };
  }
}

async function generateCoverLetterPDF(company, role, jobDescription, options = {}) {
  try {
    const { dataClient } = options;
    const cv = loadCv(dataClient);
    const profile = loadProfile(dataClient);
    const format = detectFormat(jobDescription + ' ' + company);

    const html = buildCoverLetterHTML(cv, profile, company, role, jobDescription, format);
    const filename = makeFilename('cover-letter', company, profile);
    const outputPath = await writePDFOutput(html, filename, format, dataClient);

    return {
      success: true,
      filename,
      path: outputPath,
      downloadUrl: `/download-pdf?file=${encodeURIComponent(filename)}`,
      type: 'cover-letter',
      company,
      role
    };
  } catch (error) {
    console.error('Cover Letter PDF Error:', error);
    return { success: false, error: error.message, type: 'cover-letter' };
  }
}

async function generateEvalReportPDF(job, rawMarkdown, options = {}) {
  try {
    const { dataClient } = options;
    const profile = loadProfile(dataClient);
    const format = detectFormat(job.location + ' ' + job.company);

    const html = buildEvalReportHTML(job, rawMarkdown, format);
    const filename = makeFilename('eval-report', job.company, profile);
    const outputPath = await writePDFOutput(html, filename, format, dataClient);

    return {
      success: true,
      filename,
      path: outputPath,
      downloadUrl: `/download-pdf?file=${encodeURIComponent(filename)}`,
      type: 'eval-report',
      company: job.company,
      role: job.role
    };
  } catch (error) {
    console.error('Eval Report PDF Error:', error);
    return { success: false, error: error.message, type: 'eval-report' };
  }
}

// Bundle: generate all three
async function generatePDFBundle(company, role, jobDescription, job, rawMarkdown, options = {}) {
  const results = await Promise.all([
    generateResumePDF(company, role, jobDescription, options),
    generateCoverLetterPDF(company, role, jobDescription, options),
    generateEvalReportPDF(job, rawMarkdown, options)
  ]);

  return {
    success: results.every(r => r.success),
    resume: results[0],
    coverLetter: results[1],
    evalReport: results[2],
    failures: results.filter(r => !r.success).map(r => ({ type: r.type, error: r.error }))
  };
}

module.exports = {
  generateResumePDF,
  generateCoverLetterPDF,
  generateEvalReportPDF,
  generateFullEvalReportPDF,
  generatePDFBundle,
  // Also export for direct use
  buildResumeHTML,
  buildCoverLetterHTML,
  buildEvalReportHTML,
  buildFullEvalReportHTML
};
