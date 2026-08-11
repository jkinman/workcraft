// Resume schema: the structured shape the UI edits, plus round-trip helpers
// between that object and the canonical cv.md markdown the parser/PDF consume.
const { parseCVContent } = require('../../cv-parser');

const SKILL_CATEGORIES = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'data', label: 'Data' },
  { key: 'architecture', label: 'Architecture' }
];

function emptyResume() {
  return {
    name: '',
    tagline: '',
    contact: { location: '', email: '', phone: '', website: '', linkedin: '' },
    summary: '',
    strengths: [],
    skills: { frontend: [], backend: [], cloud: [], data: [], architecture: [] },
    experience: []
  };
}

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return [];
}

// markdown -> structured object
function cvToObject(markdown) {
  const base = emptyResume();
  if (!markdown || !markdown.trim()) return base;

  const parsed = parseCVContent(markdown);

  return {
    name: parsed.name || '',
    tagline: parsed.tagline || '',
    contact: {
      location: parsed.location || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      website: parsed.website || '',
      linkedin: parsed.linkedin || ''
    },
    summary: parsed.summary || '',
    strengths: asList(parsed.strengths),
    skills: {
      frontend: asList(parsed.skills?.frontend),
      backend: asList(parsed.skills?.backend),
      cloud: asList(parsed.skills?.cloud),
      data: asList(parsed.skills?.data),
      architecture: asList(parsed.skills?.architecture)
    },
    experience: (parsed.experience || []).map(exp => ({
      company: exp.company || '',
      role: exp.role || '',
      date: exp.date || '',
      description: exp.description || '',
      highlights: asList(exp.highlights),
      technologies: asList(exp.technologies)
    }))
  };
}

// structured object -> markdown (matches cv-parser.js expectations exactly)
function cvObjectToMarkdown(input) {
  const resume = { ...emptyResume(), ...(input || {}) };
  const contact = { ...emptyResume().contact, ...(input?.contact || {}) };
  const skills = { ...emptyResume().skills, ...(input?.skills || {}) };
  const lines = [];

  lines.push(`# ${(resume.name || '').trim()}`);
  lines.push(`## ${(resume.tagline || '').trim()}`.trimEnd());
  lines.push('');

  if (contact.location) lines.push(`- **Location:** ${contact.location.trim()}`);
  if (contact.email) lines.push(`- **Email:** ${contact.email.trim()}`);
  if (contact.phone) lines.push(`- **Phone:** ${contact.phone.trim()}`);
  if (contact.website) lines.push(`- **Website:** ${contact.website.trim()}`);
  if (contact.linkedin) lines.push(`- **LinkedIn:** ${contact.linkedin.trim()}`);
  if (lines[lines.length - 1] !== '') lines.push('');

  lines.push('### Summary');
  if (resume.summary && resume.summary.trim()) lines.push(resume.summary.trim());
  lines.push('');

  const strengths = asList(resume.strengths);
  if (strengths.length) {
    lines.push('### Strengths');
    for (const item of strengths) lines.push(`- ${item}`);
    lines.push('');
  }

  lines.push('### Skills');
  for (const { key, label } of SKILL_CATEGORIES) {
    const items = asList(skills[key]);
    // The parser requires a "(n/100)" score token; it is not displayed anywhere,
    // so we emit a stable placeholder to keep the round-trip lossless.
    if (items.length) lines.push(`- **${label} (90/100):** ${items.join(', ')}`);
  }
  lines.push('');

  lines.push('### Experience');
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  experience.forEach((exp, index) => {
    const company = (exp.company || '').trim();
    const role = (exp.role || '').trim() || 'Role';
    const date = (exp.date || '').trim();
    lines.push(`**${company}** | ${role} | ${date}`);
    if (exp.description && exp.description.trim()) lines.push(`*${exp.description.trim()}*`);
    for (const item of asList(exp.highlights)) lines.push(`- ${item}`);
    const tech = asList(exp.technologies);
    if (tech.length) lines.push(`- Technologies: ${tech.join(', ')}`);
    if (index < experience.length - 1) lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
}

module.exports = {
  SKILL_CATEGORIES,
  emptyResume,
  cvToObject,
  cvObjectToMarkdown
};
