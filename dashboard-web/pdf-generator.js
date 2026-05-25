// pdf-generator.js - ATS-optimized CV generation
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const CONFIG = require('./config');

const execPromise = util.promisify(exec);

// Load CV data from resume-data.json (single source of truth)
function loadCV() {
  // Primary source: full resume data
  const resumePath = path.join(CONFIG.CAREER_OPS_PATH, '..', 'projects', 'resume', 'resume-data.json');
  if (fs.existsSync(resumePath)) {
    const data = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    return { source: 'resume-data.json', data };
  }
  
  // Fallback to cv.md
  const cvPath = path.join(CONFIG.CAREER_OPS_PATH, 'cv.md');
  if (fs.existsSync(cvPath)) {
    return { source: 'cv.md', data: fs.readFileSync(cvPath, 'utf8') };
  }
  
  throw new Error('No CV data found. Need either resume-data.json or cv.md');
}

// Load profile from config/profile.yml (or use defaults)
function loadProfile() {
  const profilePath = path.join(CONFIG.CAREER_OPS_PATH, 'config', 'profile.yml');
  
  // Default profile based on cv.md content
  const defaultProfile = {
    full_name: "Joel Kinman",
    email: "joel.kinman@gmail.com",
    phone: "778-788-1455",
    location: "Vancouver BC",
    linkedin: "linkedin.com/in/jkinman",
    portfolio_url: "https://kinman.dev",
    github: "github.com/jkinman"
  };
  
  if (!fs.existsSync(profilePath)) {
    return defaultProfile;
  }
  
  // Simple YAML parsing (for our needs)
  const content = fs.readFileSync(profilePath, 'utf8');
  const profile = { ...defaultProfile };
  
  // Extract candidate info
  const candidateMatch = content.match(/candidate:\s*\n((?:\s+\w+:\s*.*\n)+)/);
  if (candidateMatch) {
    const candidateSection = candidateMatch[1];
    const fullName = candidateSection.match(/full_name:\s*"?([^"\n]+)"?/);
    if (fullName) profile.full_name = fullName[1].trim();
    
    const email = candidateSection.match(/email:\s*"?([^"\n]+)"?/);
    if (email) profile.email = email[1].trim();
    
    const phone = candidateSection.match(/phone:\s*"?([^"\n]+)"?/);
    if (phone) profile.phone = phone[1].trim();
    
    const location = candidateSection.match(/location:\s*"?([^"\n]+)"?/);
    if (location) profile.location = location[1].trim();
    
    const linkedin = candidateSection.match(/linkedin:\s*"?([^"\n]+)"?/);
    if (linkedin) profile.linkedin = linkedin[1].trim();
    
    const portfolio = candidateSection.match(/portfolio_url:\s*"?([^"\n]+)"?/);
    if (portfolio) profile.portfolio_url = portfolio[1].trim();
    
    const github = candidateSection.match(/github:\s*"?([^"\n]+)"?/);
    if (github) profile.github = github[1].trim();
  }
  
  return profile;
}

// Extract keywords from job description
function extractKeywords(jobDescription) {
  const techKeywords = [
    'React', 'Next.js', 'TypeScript', 'Vue', 'Node', 'Express', 'Python',
    'AI', 'ML', 'LLM', 'LangChain', 'OpenAI', 'Claude', 'RAG',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST',
    'FDE', 'Forward Deployed', 'Solutions Engineer', 'Agentic',
    'Full Stack', 'Frontend', 'Backend', 'DevOps', 'MLOps'
  ];
  
  const softKeywords = [
    'leadership', 'communication', 'stakeholder management',
    'cross-functional', 'mentoring', 'architecture'
  ];
  
  const foundKeywords = [];
  const jdLower = jobDescription.toLowerCase();
  
  for (const keyword of techKeywords) {
    if (jdLower.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }
  
  for (const keyword of softKeywords) {
    if (jdLower.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }
  
  return foundKeywords.slice(0, 8); // Top 8 keywords
}

// Detect paper format based on location
function detectFormat(location) {
  const usCanadaTerms = ['usa', 'us', 'canada', 'american', 'united states', 'toronto', 'vancouver', 'sf', 'nyc', 'san francisco', 'new york'];
  const locationLower = location.toLowerCase();
  
  for (const term of usCanadaTerms) {
    if (locationLower.includes(term)) {
      return { format: 'letter', width: '8.5in', height: '11in' };
    }
  }
  
  return { format: 'a4', width: '210mm', height: '297mm' };
}

// Generate tailored summary based on job
function generateSummary(resumeData, keywords, company, role) {
  // Use JSON summary if available
  let baseSummary = resumeData.summary || '';
  
  // If no summary, create from experience
  if (!baseSummary && resumeData.experience) {
    const years = resumeData.experience.length > 0 
      ? Math.ceil((new Date().getFullYear() - 2000) / 5) * 5 
      : 10;
    baseSummary = `Over ${years} years leading teams and shipping cutting edge web applications. Solid industry experience architecting and delivering cloud based, containerized, scalable web apps with focus on frontend architecture.`;
  }
  
  // Clean up the summary
  baseSummary = baseSummary.replace(/\n/g, ' ');
  baseSummary = baseSummary.replace(/\s+/g, ' ');
  
  // Inject keywords naturally
  let tailoredSummary = baseSummary;
  
  if ((keywords.includes('AI') || keywords.includes('LLM') || keywords.includes('Agentic')) && !tailoredSummary.includes('AI')) {
    tailoredSummary = tailoredSummary.replace(
      /practical AI integration/,
      'AI, LLM-powered workflows, and practical AI integration'
    );
  }
  
  if (keywords.includes('FDE') || keywords.includes('Forward Deployed') || keywords.includes('Solutions')) {
    tailoredSummary = tailoredSummary.replace(
      /frontend architecture/,
      'frontend architecture and customer-facing solutions'
    );
  }
  
  if (keywords.includes('React') || keywords.includes('Next.js')) {
    tailoredSummary = tailoredSummary.replace(
      /React experience/,
      'React, Next.js, TypeScript with modern frontend architecture'
    );
  }
  
  // Add company/role context if it fits
  if (tailoredSummary.length < 350) {
    tailoredSummary += ` Seeking to bring ${Math.floor((new Date().getFullYear() - 2000) / 5) * 5}+ years of engineering expertise to ${company} as ${role}.`;
  }
  
  return tailoredSummary;
}

// Build HTML CV from JSON resume data
function buildHTML(profile, resumeData, keywords, company, role, format) {
  const summary = resumeData.summary || generateSummary('', keywords, company, role);
  
  // Build competencies HTML from keywords
  const competenciesHtml = keywords.map(k => 
    `<span class="competency-tag">${k}</span>`
  ).join('');
  
  // Build experience HTML from JSON data
  const experienceHtml = resumeData.experience.slice(0, 4).map(exp => {
    const dateStr = exp.current 
      ? `${exp.startDate} - Current` 
      : `${exp.startDate} - ${exp.endDate || ''}`;
    
    const highlights = exp.highlights.slice(0, 2).map(h => `<li>${h}</li>`).join('');
    
    return `
    <div class="job">
      <div class="job-header">
        <span class="job-company">${exp.company}</span>
        <span class="job-date">${dateStr}</span>
      </div>
      <div class="job-title">${exp.role}</div>
      <ul class="job-bullets">
        ${highlights}
      </ul>
    </div>
  `;
  }).join('');
  
  // Build skills from resume data + keywords
  const allSkills = [
    ...keywords,
    ...(resumeData.skills?.frontend || []),
    ...(resumeData.skills?.backend || []),
    ...(resumeData.skills?.cloud || [])
  ].slice(0, 10);
  
  const skillsHtml = [...new Set(allSkills)].join(' • ');
  
  // Load and process template
  const templatePath = path.join(CONFIG.CAREER_OPS_PATH, 'templates', 'cv-template.html');
  let template = fs.existsSync(templatePath) 
    ? fs.readFileSync(templatePath, 'utf8')
    : getDefaultTemplate();
  
  // Replace placeholders
  const replacements = {
    '{{LANG}}': 'en',
    '{{PAGE_WIDTH}}': format.width,
    '{{NAME}}': profile.full_name,
    '{{EMAIL}}': profile.email,
    '{{PHONE}}': profile.phone,
    '{{LOCATION}}': profile.location,
    '{{LINKEDIN_URL}}': `https://${profile.linkedin}`,
    '{{LINKEDIN_DISPLAY}}': profile.linkedin,
    '{{PORTFOLIO_URL}}': profile.portfolio_url,
    '{{PORTFOLIO_DISPLAY}}': profile.portfolio_url.replace('https://', ''),
    '{{SUMMARY_TEXT}}': summary,
    '{{COMPETENCIES}}': competenciesHtml,
    '{{EXPERIENCE}}': experienceHtml,
    '{{SECTION_SUMMARY}}': 'Professional Summary',
    '{{SECTION_COMPETENCIES}}': 'Core Competencies',
    '{{SECTION_EXPERIENCE}}': 'Work Experience',
    '{{SECTION_SKILLS}}': 'Skills',
    '{{SKILLS}}': skillsHtml,
    // Handle missing sections gracefully
    '{{SECTION_PROJECTS}}': '',
    '{{PROJECTS}}': '',
    '{{SECTION_EDUCATION}}': '',
    '{{EDUCATION}}': '',
    '{{SECTION_CERTIFICATIONS}}': '',
    '{{CERTIFICATIONS}}': ''
  };
  
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  
  // Clean up any remaining placeholders (remove them)
  template = template.replace(/\{\{[^}]+\}\}/g, '');
  
  return template;
}

// Default template if original not found
function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="{{LANG}}">
<head>
<meta charset="UTF-8">
<title>{{NAME}} — CV</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a2e; background: #fff; }
  .page { width: {{PAGE_WIDTH}}; margin: 0 auto; padding: 0.5in; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
  .header-gradient { height: 2px; background: linear-gradient(to right, #1a7a8e, #7a3db8); margin-bottom: 10px; }
  .contact-row { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 10.5px; color: #555; }
  .contact-row a { color: #555; text-decoration: none; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1a7a8e; border-bottom: 1.5px solid #e2e2e2; padding-bottom: 4px; margin-bottom: 10px; }
  .summary-text { font-size: 11px; line-height: 1.7; color: #2f2f2f; }
  .competencies-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .competency-tag { background: #f5f5f5; padding: 4px 10px; border-radius: 12px; font-size: 10px; color: #444; }
  .job { margin-bottom: 12px; }
  .job-header { display: flex; justify-content: space-between; font-weight: 600; }
  .job-company { color: #7a3db8; }
  .job-date { color: #666; font-size: 10px; }
  .job-title { font-size: 10.5px; color: #444; margin-bottom: 4px; }
  .job-bullets { margin-left: 16px; font-size: 10.5px; }
  .job-bullets li { margin-bottom: 2px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>{{NAME}}</h1>
    <div class="header-gradient"></div>
    <div class="contact-row">
      {{LOCATION}} | {{EMAIL}} | {{PHONE}} | <a href="{{LINKEDIN_URL}}">{{LINKEDIN_DISPLAY}}</a> | <a href="{{PORTFOLIO_URL}}">{{PORTFOLIO_DISPLAY}}</a>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">{{SECTION_SUMMARY}}</div>
    <div class="summary-text">{{SUMMARY_TEXT}}</div>
  </div>
  
  <div class="section">
    <div class="section-title">{{SECTION_COMPETENCIES}}</div>
    <div class="competencies-grid">{{COMPETENCIES}}</div>
  </div>
  
  <div class="section">
    <div class="section-title">{{SECTION_EXPERIENCE}}</div>
    {{EXPERIENCE}}
  </div>
  
  <div class="section">
    <div class="section-title">{{SECTION_SKILLS}}</div>
    <div style="font-size: 10.5px;">{{SKILLS}}</div>
  </div>
</div>
</body>
</html>`;
}

// Generate PDF using Playwright
async function generatePDF(html, outputPath, format) {
  const playwright = require('playwright');
  
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: outputPath,
    format: format.format === 'letter' ? 'Letter' : 'A4',
    printBackground: true,
    margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' }
  });
  
  await browser.close();
  
  return outputPath;
}

// Main PDF generation function
async function generateTailoredCV(company, role, jobDescription) {
  try {
    // Load data
    const cvData = loadCV();
    const profile = loadProfile();
    
    // Use JSON resume data if available, otherwise fall back to markdown
    let resumeData;
    if (cvData.source === 'resume-data.json') {
      resumeData = cvData.data;
    } else {
      // Parse markdown (legacy fallback)
      resumeData = {
        summary: '',
        experience: [],
        skills: {}
      };
    }
    
    // Extract keywords
    const keywords = extractKeywords(jobDescription);
    
    // Detect format
    const format = detectFormat(jobDescription + ' ' + company);
    
    // Build HTML using JSON resume data
  const html = buildHTML(profile, resumeData, keywords, company, role, format);
    
    // Create output directory
    const outputDir = path.join(CONFIG.CAREER_OPS_PATH, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename
    const candidateSlug = profile.full_name.toLowerCase().replace(/\s+/g, '-');
    const companySlug = company.toLowerCase().replace(/\s+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    const filename = `cv-${candidateSlug}-${companySlug}-${date}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    // Generate PDF
    await generatePDF(html, outputPath, format);
    
    return {
      success: true,
      path: outputPath,
      filename,
      keywords: keywords.length,
      format: format.format,
      company,
      role,
      experienceCount: resumeData.experience?.length || 0
    };
    
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { generateTailoredCV, extractKeywords, detectFormat };