// cv-parser.js - Parse cv.md into structured JSON data
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

function parseCV() {
  const cvPath = path.join(CONFIG.CAREER_OPS_PATH, 'cv.md');
  if (!fs.existsSync(cvPath)) {
    throw new Error('cv.md not found at ' + cvPath);
  }

  const content = fs.readFileSync(cvPath, 'utf8');
  return parseCVContent(content);
}

function parseCVContent(content) {
  const lines = content.split('\n');

  const result = {
    name: '',
    tagline: '',
    location: '',
    website: '',
    linkedin: '',
    phone: '',
    email: '',
    summary: '',
    strengths: [],
    skills: { frontend: [], backend: [], cloud: [], data: [], architecture: [] },
    experience: []
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Name
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      result.name = line.replace('# ', '').trim();
      i++;
      continue;
    }

    // Tagline
    if (line.startsWith('## ')) {
      result.tagline = line.replace('## ', '').trim();
      i++;
      continue;
    }

    // Contact info
    if (line.startsWith('- **Location:**')) {
      result.location = line.replace('- **Location:**', '').trim();
      i++;
      continue;
    }
    if (line.startsWith('- **Website:**')) {
      result.website = line.replace('- **Website:**', '').trim();
      i++;
      continue;
    }
    if (line.startsWith('- **LinkedIn:**')) {
      result.linkedin = line.replace('- **LinkedIn:**', '').trim();
      i++;
      continue;
    }
    if (line.startsWith('- **Phone:**')) {
      result.phone = line.replace('- **Phone:**', '').trim();
      i++;
      continue;
    }
    if (line.startsWith('- **Email:**')) {
      result.email = line.replace('- **Email:**', '').trim();
      i++;
      continue;
    }

    // Summary section
    if (line === '### Summary') {
      i++;
      const summaryLines = [];
      while (i < lines.length && !lines[i].trim().startsWith('### ') && !lines[i].trim().startsWith('---')) {
        if (lines[i].trim()) summaryLines.push(lines[i].trim());
        i++;
      }
      result.summary = summaryLines.join(' ');
      continue;
    }

    // Strengths section
    if (line === '### Strengths') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('### ') && !lines[i].trim().startsWith('---')) {
        const match = lines[i].match(/^-\s+(.+)$/);
        if (match) result.strengths.push(match[1].trim());
        i++;
      }
      continue;
    }

    // Skills section
    if (line === '### Skills') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('### ') && !lines[i].trim().startsWith('---')) {
        const match = lines[i].match(/^-\s+\*\*(.+?)\s*\(\d+\/100\):\*\*\s*(.+)$/);
        if (match) {
          const category = match[1].toLowerCase().replace(/ and /g, '-').replace(/\s+/g, '-');
          const items = match[2].split(',').map(s => s.trim()).filter(Boolean);
          if (category.includes('frontend')) result.skills.frontend = items;
          else if (category.includes('backend')) result.skills.backend = items;
          else if (category.includes('cloud') || category.includes('platform')) result.skills.cloud = items;
          else if (category.includes('data') || category.includes('ai')) result.skills.data = items;
          else if (category.includes('architecture') || category.includes('systems')) result.skills.architecture = items;
        }
        i++;
      }
      continue;
    }

    // Experience section
    if (line === '### Experience') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('### ') && !lines[i].trim().startsWith('---')) {
        const expMatch = lines[i].match(/^\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+?)$/);
        if (expMatch) {
          const exp = {
            company: expMatch[1].trim(),
            role: expMatch[2].trim(),
            date: expMatch[3].trim(),
            description: '',
            highlights: [],
            technologies: []
          };
          i++;
          // Description (italic line)
          if (i < lines.length && lines[i].trim().startsWith('*')) {
            exp.description = lines[i].trim().replace(/^\*+|\*+$/g, '').trim();
            i++;
          }
          // Highlights and technologies
          while (i < lines.length && lines[i].trim().startsWith('-')) {
            const item = lines[i].trim().replace(/^-\s*/, '');
            if (item.startsWith('Technologies:')) {
              exp.technologies = item.replace('Technologies:', '').split(',').map(s => s.trim()).filter(Boolean);
            } else {
              exp.highlights.push(item);
            }
            i++;
          }
          result.experience.push(exp);
          continue;
        }
        i++;
      }
      continue;
    }

    i++;
  }

  return result;
}

module.exports = { parseCV, parseCVContent };
