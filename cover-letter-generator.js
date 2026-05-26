// cover-letter-generator.js - Tailored cover letter generation
const fs = require('fs');
const path = require('path');
const { generatePDF } = require('./pdf-generator');
const CONFIG = require('./config');

// Load resume data
function loadResumeData() {
  const resumePath = path.join(CONFIG.CAREER_OPS_PATH, '..', 'projects', 'resume', 'resume-data.json');
  if (fs.existsSync(resumePath)) {
    return JSON.parse(fs.readFileSync(resumePath, 'utf8'));
  }
  throw new Error('resume-data.json not found');
}

// Load profile
function loadProfile() {
  const profilePath = path.join(CONFIG.CAREER_OPS_PATH, 'config', 'profile.yml');
  const defaultProfile = {
    full_name: "Career-Ops Candidate",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio_url: ""
  };
  
  if (!fs.existsSync(profilePath)) {
    return defaultProfile;
  }
  
  const content = fs.readFileSync(profilePath, 'utf8');
  const profile = { ...defaultProfile };
  
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
  }
  
  return profile;
}

// Extract company-specific hook from job description
function generateHook(company, role, jobDescription, archetype) {
  const hooks = {
    'AI': `I've been building LLM-powered workflows and AI-native features in production at Highspot, and I'm excited about ${company}'s approach to ${archetype || 'AI engineering'}.`,
    'FDE': `My experience bridging technical implementation with customer success at Highspot aligns well with ${company}'s Forward Deployed Engineer model.`,
    'Platform': `Having architected component libraries and design systems that power 10+ internal apps, I'm drawn to ${company}'s platform engineering challenges.`,
    'Full Stack': `With 20 years shipping end-to-end—from AAA games to cloud platforms—I thrive in full-stack roles like this ${role} position.`,
    'default': `With 20 years of engineering experience spanning AAA games to AI-powered cloud platforms, I'm excited about the ${role} opportunity at ${company}.`
  };
  
  const jdLower = (jobDescription || '').toLowerCase();
  if (jdLower.includes('ai') || jdLower.includes('llm') || jdLower.includes('ml')) return hooks.AI;
  if (jdLower.includes('forward deployed') || jdLower.includes('fde') || jdLower.includes('solutions')) return hooks.FDE;
  if (jdLower.includes('platform') || jdLower.includes('infrastructure')) return hooks.Platform;
  if (jdLower.includes('full stack') || jdLower.includes('fullstack')) return hooks['Full Stack'];
  
  return hooks.default;
}

// Select relevant proof points based on job
function selectProofPoints(resumeData, jobDescription) {
  const jdLower = (jobDescription || '').toLowerCase();
  const proofPoints = [];
  
  // Map job keywords to experience highlights
  const experience = resumeData.experience || [];
  
  for (const exp of experience.slice(0, 4)) {
    const expText = `${exp.role} ${exp.description} ${exp.highlights?.join(' ') || ''}`.toLowerCase();
    
    // Check for relevance
    let relevance = 0;
    if (jdLower.includes('ai') && expText.includes('llm')) relevance += 3;
    if (jdLower.includes('react') && expText.includes('react')) relevance += 2;
    if (jdLower.includes('frontend') && expText.includes('frontend')) relevance += 2;
    if (jdLower.includes('full stack') && expText.includes('full stack')) relevance += 2;
    if (jdLower.includes('component') && expText.includes('component')) relevance += 2;
    if (jdLower.includes('design system') && expText.includes('storybook')) relevance += 2;
    
    if (relevance > 0 || proofPoints.length < 2) {
      const highlight = exp.highlights?.[0] || exp.description;
      proofPoints.push({
        company: exp.company,
        role: exp.role,
        highlight: highlight,
        relevance
      });
    }
  }
  
  return proofPoints.slice(0, 3).sort((a, b) => b.relevance - a.relevance);
}

// Generate skills bridge
function generateSkillsBridge(resumeData, jobDescription) {
  const skills = resumeData.skills || {};
  const allSkills = [
    ...(skills.frontend || []),
    ...(skills.backend || []),
    ...(skills.cloud || []),
    ...(skills.data || [])
  ];
  
  const jdLower = (jobDescription || '').toLowerCase();
  const matchedSkills = allSkills.filter(skill => 
    jdLower.includes(skill.toLowerCase())
  ).slice(0, 5);
  
  if (matchedSkills.length === 0) {
    return `My core stack includes ${allSkills.slice(0, 4).join(', ')}, and I'm quick to adapt to new technologies.`;
  }
  
  return `My experience with ${matchedSkills.join(', ')} directly aligns with your tech stack, and I've consistently delivered production systems at scale.`;
}

// Generate cover letter text
function generateCoverLetterText(profile, resumeData, company, role, jobDescription, archetype) {
  const hook = generateHook(company, role, jobDescription, archetype);
  const proofPoints = selectProofPoints(resumeData, jobDescription);
  const skillsBridge = generateSkillsBridge(resumeData, jobDescription);
  
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let proofSection = '';
  if (proofPoints.length > 0) {
    proofSection = proofPoints.map(p => 
      `At ${p.company}, ${p.highlight.charAt(0).toLowerCase() + p.highlight.slice(1)}`
    ).join(' ');
  }
  
  return `Dear ${company} Hiring Team,

${hook}

${proofSection}

${skillsBridge}

I'm particularly drawn to ${company} because of your reputation for ${archetype ? archetype.toLowerCase() : 'technical excellence'}. The ${role} role represents exactly the kind of high-impact work I want to be doing next—${jobDescription ? 'building systems that ' + (jobDescription.toLowerCase().includes('scale') ? 'scale' : 'solve real problems') : 'shipping products people use'}.

I'd welcome the opportunity to discuss how my background in ${resumeData.experience?.[0]?.role || 'engineering'} and ${resumeData.experience?.[1]?.role || 'product development'} could contribute to ${company}'s goals.

Best regards,
${profile.full_name}
${profile.email}
${profile.linkedin}`;
}

// Build HTML cover letter for PDF
function buildCoverLetterHTML(profile, letterText, company, format) {
  const formattedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cover Letter - ${profile.full_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'DM Sans', 'Segoe UI', sans-serif; 
    font-size: 11px; 
    line-height: 1.6; 
    color: #1a1a2e; 
    background: #fff; 
  }
  .page { 
    width: ${format.format === 'letter' ? '8.5in' : '210mm'}; 
    margin: 0 auto; 
    padding: 0.75in; 
  }
  .header {
    margin-bottom: 30px;
  }
  .header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 4px;
  }
  .header-gradient {
    height: 2px;
    background: linear-gradient(to right, hsl(187, 74%, 32%), hsl(270, 70%, 45%));
    margin-bottom: 8px;
  }
  .contact-info {
    font-size: 10px;
    color: #555;
    margin-bottom: 20px;
  }
  .date {
    font-size: 10.5px;
    color: #666;
    margin-bottom: 20px;
  }
  .recipient {
    margin-bottom: 20px;
  }
  .recipient-line {
    font-size: 11px;
    line-height: 1.5;
  }
  .salutation {
    font-size: 11px;
    margin-bottom: 16px;
  }
  .body-text {
    font-size: 11px;
    line-height: 1.7;
    margin-bottom: 12px;
    text-align: justify;
  }
  .closing {
    margin-top: 24px;
  }
  .signature {
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.5;
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>${profile.full_name}</h1>
    <div class="header-gradient"></div>
    <div class="contact-info">
      ${profile.email} | ${profile.phone} | ${profile.linkedin}
    </div>
  </div>
  
  <div class="date">${formattedDate}</div>
  
  <div class="recipient">
    <div class="recipient-line">Hiring Team</div>
    <div class="recipient-line">${company}</div>
  </div>
  
  <div class="salutation">Dear ${company} Hiring Team,</div>
  
  ${letterText.split('\n\n').slice(1, -4).map(p => `<div class="body-text">${p.replace(/\n/g, ' ')}</div>`).join('')}
  
  <div class="closing">
    <div class="body-text">Best regards,</div>
    <div class="signature">
      ${profile.full_name}<br>
      ${profile.email}<br>
      ${profile.linkedin}
    </div>
  </div>
</div>
</body>
</html>`;
}

// Generate cover letter
async function generateCoverLetter(company, role, jobDescription, archetype) {
  try {
    const resumeData = loadResumeData();
    const profile = loadProfile();
    
    // Generate letter text
    const letterText = generateCoverLetterText(profile, resumeData, company, role, jobDescription, archetype);
    
    // Detect format
    const format = detectFormat(jobDescription + ' ' + company);
    
    // Build HTML
    const html = buildCoverLetterHTML(profile, letterText, company, format);
    
    // Create output directory
    const outputDir = path.join(CONFIG.CAREER_OPS_PATH, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename
    const candidateSlug = profile.full_name.toLowerCase().replace(/\s+/g, '-');
    const companySlug = company.toLowerCase().replace(/\s+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    
    // Save text version
    const textFilename = `cover-letter-${candidateSlug}-${companySlug}-${date}.txt`;
    const textPath = path.join(outputDir, textFilename);
    fs.writeFileSync(textPath, letterText, 'utf8');
    
    // Generate PDF
    const pdfFilename = `cover-letter-${candidateSlug}-${companySlug}-${date}.pdf`;
    const pdfPath = path.join(outputDir, pdfFilename);
    await generatePDF(html, pdfPath, format);
    
    return {
      success: true,
      text: letterText,
      textFilename,
      textPath,
      pdfFilename,
      pdfPath,
      downloadUrl: `/download-pdf?file=${encodeURIComponent(pdfFilename)}`,
      company,
      role
    };
    
  } catch (error) {
    console.error('Cover Letter Generation Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Detect paper format
function detectFormat(location) {
  const usCanadaTerms = ['usa', 'us', 'canada', 'american', 'united states', 'toronto', 'vancouver', 'sf', 'nyc'];
  const locationLower = (location || '').toLowerCase();
  
  for (const term of usCanadaTerms) {
    if (locationLower.includes(term)) {
      return { format: 'letter', width: '8.5in', height: '11in' };
    }
  }
  
  return { format: 'a4', width: '210mm', height: '297mm' };
}

module.exports = { generateCoverLetter, generateCoverLetterText };