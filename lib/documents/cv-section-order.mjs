/**
 * CV section-order guard for HTML renders vs cv.md source.
 */

function foldDiacritics(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

const SECTION_ALIASES = new Map([
  ['summary', 'summary'],
  ['professional summary', 'summary'],
  ['competencies', 'competencies'],
  ['core competencies', 'competencies'],
  ['experience', 'experience'],
  ['work experience', 'experience'],
  ['professional experience', 'experience'],
  ['projects', 'projects'],
  ['selected projects', 'projects'],
  ['personal projects', 'projects'],
  ['education', 'education'],
  ['education & certifications', 'education'],
  ['certifications', 'certifications'],
  ['awards', 'awards'],
  ['honors', 'awards'],
  ['honours', 'awards'],
  ['awards & honors', 'awards'],
  ['awards and honors', 'awards'],
  ['honors & awards', 'awards'],
  ['awards & honours', 'awards'],
  ['skills', 'skills'],
  ['technical skills', 'skills'],
  ['podsumowanie', 'summary'],
  ['podsumowanie zawodowe', 'summary'],
  ['profil zawodowy', 'summary'],
  ['kompetencje', 'competencies'],
  ['kompetencje kluczowe', 'competencies'],
  ['kluczowe kompetencje', 'competencies'],
  ['doświadczenie', 'experience'],
  ['doświadczenie zawodowe', 'experience'],
  ['przebieg kariery', 'experience'],
  ['projekty', 'projects'],
  ['kluczowe projekty', 'projects'],
  ['wybrane projekty', 'projects'],
  ['wykształcenie', 'education'],
  ['edukacja', 'education'],
  ['wykształcenie i certyfikaty', 'education'],
  ['certyfikaty', 'certifications'],
  ['certyfikaty i szkolenia', 'certifications'],
  ['szkolenia i certyfikaty', 'certifications'],
  ['nagrody', 'awards'],
  ['wyróżnienia', 'awards'],
  ['nagrody i wyróżnienia', 'awards'],
  ['umiejętności', 'skills'],
  ['umiejętności techniczne', 'skills'],
].map(([alias, key]) => [foldDiacritics(alias), key]));

function normalizeSectionTitle(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sectionKey(text) {
  const normalized = foldDiacritics(normalizeSectionTitle(text));
  return SECTION_ALIASES.get(normalized) ?? normalized;
}

function extractRenderedSectionOrder(html) {
  const titleMatches = [...html.matchAll(/class=["'][^"']*\bsection-title\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)];
  const sections = [];
  for (const match of titleMatches) {
    const text = normalizeSectionTitle(match[1]);
    if (!text) continue;
    sections.push({ key: sectionKey(text), title: text });
  }
  return sections;
}

function extractSourceSectionOrder(markdown) {
  const sections = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const text = normalizeSectionTitle(heading[2]);
    if (!text) continue;
    sections.push({ key: sectionKey(text), title: text });
  }
  return sections;
}

export function validateCvSectionOrder(html, cvMarkdown, { allowReorder = false } = {}) {
  const rendered = extractRenderedSectionOrder(html);
  const source = extractSourceSectionOrder(cvMarkdown);
  if (rendered.length < 2 || source.length < 2) return;

  const sourcePositions = new Map(source.map((section, index) => [section.key, index]));
  const renderedComparable = rendered.filter(section => sourcePositions.has(section.key));
  if (renderedComparable.length < 2) return;

  for (let i = 1; i < renderedComparable.length; i++) {
    const previous = renderedComparable[i - 1];
    const current = renderedComparable[i];
    if (sourcePositions.get(current.key) < sourcePositions.get(previous.key)) {
      const renderedOrder = renderedComparable.map(section => section.title).join(' -> ');
      const sourceOrder = source
        .filter(section => renderedComparable.some(renderedSection => renderedSection.key === section.key))
        .map(section => section.title)
        .join(' -> ');
      const message = `CV section order diverges from cv.md: rendered ${renderedOrder}; cv.md ${sourceOrder}`;
      if (allowReorder) {
        console.warn(`⚠️  ${message} (proceeding — --allow-reorder set)`);
        return;
      }
      throw new Error(message);
    }
  }
}

export function enforcePageBudget(pageCount, { maxPages = 2, strictPages = false } = {}) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`Could not determine the rendered PDF page count (received ${pageCount}).`);
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error(`Invalid page budget "${maxPages}". Use a positive integer.`);
  }
  if (pageCount <= maxPages) return;

  const message =
    `CV is ${pageCount} pages; the allowed maximum is ${maxPages} ${maxPages === 1 ? 'page' : 'pages'}. ` +
    'Trim lower-priority bullets, older roles, secondary projects, or the competencies strip, then regenerate.';

  if (strictPages) {
    throw new Error(`${message} (--strict-pages requested)`);
  }

  console.warn(`⚠️  ${message} Continuing because overflow is warning-only by default; use --strict-pages to reject it.`);
}
