/**
 * Parse cv.md markdown into structured JSON — import-safe, no filesystem I/O.
 */

export function parseCVContent(content) {
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

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      result.name = line.replace('# ', '').trim();
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      result.tagline = line.replace('## ', '').trim();
      i++;
      continue;
    }

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

    if (line === '### Strengths') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('### ') && !lines[i].trim().startsWith('---')) {
        const match = lines[i].match(/^-\s+(.+)$/);
        if (match) result.strengths.push(match[1].trim());
        i++;
      }
      continue;
    }

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
          if (i < lines.length && lines[i].trim().startsWith('*')) {
            exp.description = lines[i].trim().replace(/^\*+|\*+$/g, '').trim();
            i++;
          }
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
