const REQUIRED_SECTIONS = ['### Summary', '### Skills', '### Experience'];
const MAX_BYTES = 5 * 1024 * 1024;

// Common resume heading wording -> our canonical cv.md sections.
const SECTION_SYNONYMS = {
  summary: ['summary', 'professional summary', 'profile', 'about', 'about me', 'objective', 'career summary', 'executive summary', 'overview'],
  strengths: ['strengths', 'key strengths', 'core strengths', 'highlights', 'key highlights', 'what i bring'],
  skills: ['skills', 'technical skills', 'core skills', 'core competencies', 'competencies', 'technologies', 'tech stack', 'expertise', 'key skills'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'professional background'],
  education: ['education', 'academic background', 'qualifications', 'academics'],
  projects: ['projects', 'selected projects', 'key projects', 'notable projects'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses & certifications']
};

const EXTRA_SECTION_TITLES = {
  education: 'Education',
  projects: 'Projects',
  certifications: 'Certifications'
};

function normalizeText(value) {
  return (value || '')
    .replace(/\r\n/g, '\n')
    // PDF bullet glyphs often extract as a leading null byte — turn them into markdown bullets.
    .replace(/^[ \t]*\u0000[ \t]*/gm, '- ')
    .replace(/\u0000/g, '')
    .trim();
}

// Rejoin hard-wrapped lines: a line that continues the previous one (starts
// lowercase, previous didn't end a sentence) is merged back. Fixes resumes
// where every line break in the PDF became its own fragment.
function dewrapLines(text) {
  const out = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[ \t]+$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      out.push('');
      continue;
    }

    const prev = out.length ? out[out.length - 1] : '';
    const prevTrim = prev.trim();
    const startsLower = /^[a-z(]/.test(trimmed);
    const prevEndsOpen = /[,(-]$/.test(prevTrim);
    const isContinuation =
      prevTrim &&
      !prevTrim.startsWith('#') &&
      (startsLower ? !/[.!?:]$/.test(prevTrim) : prevEndsOpen);

    if (isContinuation) {
      out[out.length - 1] = /-$/.test(prevTrim) ? prev + trimmed : `${prev} ${trimmed}`;
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

function looksLikeResumeMarkdown(text) {
  return REQUIRED_SECTIONS.some(section => text.includes(section));
}

function firstNonEmptyLine(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
}

function fileExtension(filename) {
  const parts = String(filename || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function matchSectionHeading(line) {
  const cleaned = line
    .replace(/^#+\s*/, '')
    .replace(/[:|*_-]+$/g, '')
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > 40) return null;
  for (const [section, names] of Object.entries(SECTION_SYNONYMS)) {
    if (names.includes(cleaned)) return section;
  }
  return null;
}

function looksLikeContact(line) {
  return /@|https?:\/\/|linkedin\.com|github\.com|\d{3}[\s.-]?\d{3}/i.test(line);
}

function extractContact(preambleLines, { name = '', tagline = '' } = {}) {
  // Tabs (recovered column gaps) are treated as field separators.
  let blob = preambleLines.join(' | ').replace(/\t+/g, ' | ');
  const contact = {};

  // Some extractors glue "City PROV" straight onto the email
  // (e.g. "Vancouver BCjoel.kinman@..."). Recover the location and un-glue it.
  const glued = blob.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s([A-Z]{2})(?=[a-z])/);
  if (glued) {
    contact.location = `${glued[1]}, ${glued[2]}`;
    blob = blob.replace(glued[0], `${glued[1]} ${glued[2]} `);
  }

  // TLD limited to letters so a mashed run (e.g. "gmail.com778-788") stops at ".com".
  const email = blob.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/);
  if (email) contact.email = email[0];

  const phone = blob.match(/\+?\d[\d\s().-]{7,}\d/);
  if (phone) contact.phone = phone[0].trim();

  const linkedin = blob.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i);
  if (linkedin) contact.linkedin = linkedin[0];

  const urls = blob.match(/https?:\/\/[^\s|]+/gi) || [];
  const website = urls.find(url => !/linkedin\.com/i.test(url));
  if (website) contact.website = website;

  // Location: a short title-cased segment that isn't the name/tagline or contact.
  const skip = new Set([name, tagline].filter(Boolean));
  for (const line of contact.location ? [] : preambleLines) {
    if (skip.has(line.trim())) continue;
    for (const segment of line.split(/[|\t]/).map(part => part.trim())) {
      if (!segment || segment.length > 40 || skip.has(segment)) continue;
      if (looksLikeContact(segment)) continue;
      if (segment === segment.toUpperCase()) continue; // all-caps -> likely a name
      if (/^[A-Za-z][A-Za-z .,'-]+$/.test(segment) && /\s|,/.test(segment)) {
        contact.location = segment;
        break;
      }
    }
    if (contact.location) break;
  }

  return contact;
}

function pickNameAndTagline(preambleLines) {
  const candidates = preambleLines.filter(line => !looksLikeContact(line));
  const name = candidates.find(line => line.length <= 60 && !/\d/.test(line)) || preambleLines[0] || 'Your Name';
  const tagline = candidates.find(line => line !== name && line.length <= 200) || '';
  return { name, tagline };
}

function buildContactBlock(contact) {
  const lines = [];
  if (contact.location) lines.push(`- **Location:** ${contact.location}`);
  if (contact.email) lines.push(`- **Email:** ${contact.email}`);
  if (contact.phone) lines.push(`- **Phone:** ${contact.phone}`);
  if (contact.website) lines.push(`- **Website:** ${contact.website}`);
  if (contact.linkedin) lines.push(`- **LinkedIn:** ${contact.linkedin}`);
  return lines;
}

function trimBucket(lines) {
  return lines.join('\n').trim();
}

// Turn loose strength/highlight lines into "- " bullets the parser reads.
// PDF exports often use stray ">" or bullet glyphs as separators.
function formatStrengthsBucket(lines) {
  return lines
    .map(line => line.replace(/^[>•\-*\u2022\s]+/, '').trim())
    .filter(Boolean)
    .map(line => `- ${line}`)
    .join('\n')
    .trim();
}

const DATE_HINT = /\b((19|20)\d{2}|present|current)\b/i;
const COLUMN_SPLIT = /\t+|\s{2,}/;
// Where a date range begins inside a header line (used to split mashed
// "CompanyApr 2023 - Current" rows that lost their separator on extraction).
const DATE_BOUNDARY = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s?\d{4}|(19|20)\d{2}|Present|Current)/;

// A tab-separated tech/tag row (e.g. "React\tNext.js\tNode\tTypeScript")
// recovered by the gap-aware PDF renderer. Returns the tags, or null if the
// line is a date header or prose.
function splitTechLine(line) {
  if (!line.includes('\t')) return null;
  const segments = line.split('\t').map(part => part.trim()).filter(Boolean);
  if (segments.length < 2) return null;
  if (segments.some(seg => DATE_HINT.test(seg))) return null; // a "Company<tab>Date" header
  if (segments.some(seg => seg.length > 30 || /[.!?]$/.test(seg))) return null; // prose
  return segments;
}

// A run-together tech stack row (e.g. "ReactNext.jsNodeTypeScript") whose
// separators were lost on extraction and could not be recovered (non-PDF
// sources). Prose never camel-cases mid-word, so this flags the unreadable
// blobs without touching real sentences.
function isMashedTechLine(line) {
  return /[a-z][A-Z]/.test(line) && !/[.!?]$/.test(line) && line.length <= 90;
}

// Detect a "job header" line and pull out company + date + (inline) role.
// Handles three real-world layouts:
//   1. "Company | Role | Date"   (already pipe-separated)
//   2. "Company<tab/2+ spaces>Date"
//   3. "CompanyApr 2023 - Current" (separator lost on extraction)
function detectExperienceHeader(line) {
  const t = line.trim();
  if (!t || t.startsWith('-') || t.startsWith('*') || t.startsWith('#')) return null;

  const pipe = t.split('|').map(part => part.trim());
  if (pipe.length === 3 && pipe.every(Boolean) && DATE_HINT.test(pipe[2])) {
    return { company: pipe[0], role: pipe[1], date: pipe[2] };
  }

  if (t.length > 70) return null;

  const columns = t.split(COLUMN_SPLIT).map(part => part.trim()).filter(Boolean);
  if (columns.length === 2 && DATE_HINT.test(columns[1]) && !DATE_HINT.test(columns[0])) {
    return { company: columns[0], role: '', date: columns[1] };
  }

  const match = t.match(DATE_BOUNDARY);
  if (match && match.index >= 2 && match.index <= 45) {
    return { company: t.slice(0, match.index).trim(), role: '', date: match[0] ? t.slice(match.index).trim() : '' };
  }

  return null;
}

// Build the parser's expected per-job shape:
//   **Company** | Role | Date
//   *one-line description*
//   - achievement
//   - achievement
// Everything between two headers is captured so nothing is dropped.
function formatExperienceBucket(lines) {
  const blocks = [];
  let idx = 0;

  while (idx < lines.length) {
    const header = detectExperienceHeader(lines[idx]);
    if (!header) {
      idx += 1;
      continue;
    }
    idx += 1;

    let role = header.role;
    if (!role) {
      while (idx < lines.length && !lines[idx].trim()) idx += 1;
      if (idx < lines.length && !detectExperienceHeader(lines[idx])) {
        role = lines[idx].trim();
        idx += 1;
      }
    }

    const descParts = [];
    const highlights = [];
    const technologies = [];
    while (idx < lines.length && !detectExperienceHeader(lines[idx])) {
      const body = lines[idx].trim();
      if (body) {
        const tech = splitTechLine(body);
        if (tech) technologies.push(...tech);
        else if (body.startsWith('-')) highlights.push(body.replace(/^-+\s*/, ''));
        else if (isMashedTechLine(body)) technologies.push(body);
        else descParts.push(body);
      }
      idx += 1;
    }

    const block = [`**${header.company}** | ${role || 'Role'} | ${header.date}`];
    if (descParts.length) block.push(`*${descParts.join(' ')}*`);
    for (const item of highlights) block.push(`- ${item}`);
    if (technologies.length) block.push(`- Technologies: ${technologies.join(', ')}`);
    blocks.push(block.join('\n'));
  }

  return blocks.join('\n\n').trim();
}

// Best-effort: turns extracted plain text into a cv.md scaffold the parser
// understands. Returns { content, structured }. If we can't find any resume
// headings, falls back to a labeled scaffold for the user to organize.
function structureResumeText(rawText, { filename } = {}) {
  const text = dewrapLines(normalizeText(rawText));
  if (!text) {
    throw new Error('No readable text was found in that file.');
  }
  if (looksLikeResumeMarkdown(text)) {
    return { content: text, structured: true };
  }

  const sections = { preamble: [] };
  const detectedOrder = [];
  let current = 'preamble';

  for (const rawLine of text.split('\n')) {
    const matched = matchSectionHeading(rawLine.trim());
    if (matched) {
      current = matched;
      if (!sections[current]) {
        sections[current] = [];
        detectedOrder.push(current);
      }
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(rawLine);
  }

  if (!detectedOrder.length) {
    return { content: scaffoldResumeMarkdown(text, { filename }), structured: false };
  }

  const preamble = sections.preamble.map(line => line.trim()).filter(Boolean);
  const { name, tagline } = pickNameAndTagline(preamble);
  const contact = extractContact(preamble, { name, tagline });

  const out = [`# ${name}`, `## ${tagline}`.trimEnd(), ''];

  const contactBlock = buildContactBlock(contact);
  if (contactBlock.length) {
    out.push(...contactBlock, '');
  }

  out.push('### Summary', trimBucket(sections.summary || []), '');
  if (sections.strengths && formatStrengthsBucket(sections.strengths)) {
    out.push('### Strengths', formatStrengthsBucket(sections.strengths), '');
  }
  out.push('### Skills', trimBucket(sections.skills || []), '');
  out.push('### Experience', formatExperienceBucket(sections.experience || []), '');

  for (const key of Object.keys(EXTRA_SECTION_TITLES)) {
    if (sections[key] && trimBucket(sections[key])) {
      out.push(`### ${EXTRA_SECTION_TITLES[key]}`, trimBucket(sections[key]), '');
    }
  }

  return { content: `${out.join('\n').trim()}\n`, structured: true };
}

// Fallback for fully unstructured text: keep everything, just add headers.
function scaffoldResumeMarkdown(rawText, { name, filename } = {}) {
  const text = normalizeText(rawText);
  if (!text) {
    throw new Error('No readable text was found in that file.');
  }
  if (looksLikeResumeMarkdown(text)) {
    return text;
  }

  const guessedName = (name && name.trim()) || firstNonEmptyLine(text) || 'Your Name';
  const note = `<!-- Imported${filename ? ` from ${filename}` : ''}. Reorganize the text below into the sections above, then Save. -->`;

  return [
    `# ${guessedName}`,
    '## ',
    '',
    '### Summary',
    '',
    '### Skills',
    '',
    '### Experience',
    '',
    note,
    '',
    text
  ].join('\n');
}

// pdf-parse's default renderer concatenates text fragments with no spacing,
// which mashes spatially-laid-out content (tag pills, "Company  Date" columns,
// contact rows). This reconstructs the gaps: large horizontal gaps become tabs
// (column/tag separators), normal gaps become spaces, new rows become newlines.
function renderPageWithGaps(pageData) {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then(textContent => {
      let out = '';
      let lastY = null;
      let prevEndX = null;
      let lastSize = 10;

      for (const item of textContent.items) {
        const y = item.transform[5];
        const x = item.transform[4];
        const width = item.width || 0;
        const size = Math.abs(item.transform[3]) || lastSize;
        lastSize = size;

        if (lastY === null) {
          out += item.str;
        } else if (Math.abs(y - lastY) > size * 0.5) {
          out += `\n${item.str}`;
          prevEndX = null;
        } else {
          const gap = prevEndX === null ? 0 : x - prevEndX;
          if (gap > size * 0.6) {
            out += `\t${item.str}`;
          } else if (gap > size * 0.12 && !/\s$/.test(out) && !/^\s/.test(item.str)) {
            out += ` ${item.str}`;
          } else {
            out += item.str;
          }
        }

        lastY = y;
        prevEndX = x + width;
      }

      return out;
    });
}

async function extractText({ buffer, filename, mimeType }) {
  if (!buffer || !buffer.length) {
    throw new Error('The uploaded file is empty.');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error('File is too large (max 5MB).');
  }

  const ext = fileExtension(filename);
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || mime.startsWith('text/')) {
    return buffer.toString('utf8');
  }

  if (ext === 'docx' || mime.includes('officedocument.wordprocessingml')) {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (ext === 'pdf' || mime === 'application/pdf') {
    // Import the implementation file directly to avoid pdf-parse's debug harness
    // (which reads a sample file at module load and breaks under bundling).
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer, { pagerender: renderPageWithGaps });
    return data.text;
  }

  throw new Error(`Unsupported file type "${ext || mime || 'unknown'}". Use PDF, DOCX, TXT, or Markdown.`);
}

async function importResumeFromFile({ buffer, filename, mimeType }) {
  const text = await extractText({ buffer, filename, mimeType });
  const { content, structured } = structureResumeText(text, { filename });
  return {
    filename: filename || null,
    content,
    structured
  };
}

module.exports = {
  MAX_BYTES,
  REQUIRED_SECTIONS,
  extractText,
  importResumeFromFile,
  looksLikeResumeMarkdown,
  scaffoldResumeMarkdown,
  structureResumeText
};
