// pipeline.js - Pipeline data parsing and management
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

function parsePipeline() {
  const pipelinePath = path.join(CONFIG.CAREER_OPS_PATH, CONFIG.DATA_DIR, CONFIG.PIPELINE_FILE);
  
  if (!fs.existsSync(pipelinePath)) {
    return { pending: [], inProgress: [], applied: [], rejected: [], total: 0 };
  }

  const content = fs.readFileSync(pipelinePath, 'utf8');
  const lines = content.split('\n');
  
  const jobs = {
    pending: [],
    inProgress: [],
    applied: [],
    rejected: [],
    total: 0
  };

  let currentSection = null;

  for (const line of lines) {
    if (line.includes('Pendientes') || line.includes('Pending')) {
      currentSection = 'pending';
      continue;
    }
    if (line.includes('En Progreso') || line.includes('In Progress')) {
      currentSection = 'inProgress';
      continue;
    }
    if (line.includes('Aplicado') || line.includes('Applied')) {
      currentSection = 'applied';
      continue;
    }
    if (line.includes('Rechazado') || line.includes('Rejected')) {
      currentSection = 'rejected';
      continue;
    }

    const match = line.match(/^- \[([ x])\] (https:\/\/[^\s]+) \| ([^|]+) \| (.+)$/);
    if (match && currentSection) {
      const [, checked, url, company, role] = match;
      const status = checked === 'x' ? 'done' : 'pending';
      
      jobs[currentSection].push({
        url,
        company: company.trim(),
        role: role.trim(),
        status
      });
      jobs.total++;
    }
  }

  return jobs;
}

function addToPipeline(url, notes) {
  let company = 'Unknown';
  let role = 'Unknown';
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (hostname.includes('ashbyhq.com')) {
      const match = url.match(/ashbyhq\.com\/([^\/]+)/);
      if (match) company = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    } else if (hostname.includes('greenhouse.io')) {
      const match = url.match(/greenhouse\.io\/([^\/]+)/);
      if (match) company = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    } else if (hostname.includes('lever.co')) {
      const match = url.match(/lever\.co\/([^\/]+)/);
      if (match) company = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    } else {
      company = hostname.replace(/^www\./, '').split('.')[0];
      company = company.charAt(0).toUpperCase() + company.slice(1);
    }
    
    if (notes && notes.includes('-')) {
      role = notes.split('-')[0].trim();
    }
  } catch (e) {
    console.error('Error parsing URL:', e);
  }

  const pipelinePath = path.join(CONFIG.CAREER_OPS_PATH, CONFIG.DATA_DIR, CONFIG.PIPELINE_FILE);
  const entry = `- [ ] ${url} | ${company} | ${role}${notes ? ' - ' + notes : ''}`;
  
  let content = '';
  if (fs.existsSync(pipelinePath)) {
    content = fs.readFileSync(pipelinePath, 'utf8');
  }
  
  if (!content.includes('Pendientes') && !content.includes('Pending')) {
    content += '\n## Pendientes\n\n';
  }
  
  const pendingIndex = content.indexOf('## Pendientes') || content.indexOf('## Pending');
  if (pendingIndex !== -1) {
    const sectionEnd = content.indexOf('##', pendingIndex + 1);
    if (sectionEnd !== -1) {
      content = content.slice(0, sectionEnd) + entry + '\n' + content.slice(sectionEnd);
    } else {
      content += '\n' + entry + '\n';
    }
  } else {
    content += '\n## Pendientes\n\n' + entry + '\n';
  }
  
  fs.writeFileSync(pipelinePath, content);
  
  return { url, company, role, notes };
}

module.exports = { parsePipeline, addToPipeline };