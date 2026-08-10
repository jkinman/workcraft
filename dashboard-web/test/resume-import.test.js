import { describe, expect, it } from 'vitest';
import { parseCVContent } from '../cv-parser';
import {
  extractText,
  importResumeFromFile,
  looksLikeResumeMarkdown,
  scaffoldResumeMarkdown,
  structureResumeText
} from '../lib/services/resume-import';

const REAL_RESUME = `Joel Kinman
Creative problem solver who loves to make cool stuff
Vancouver BC | joel.kinman@gmail.com | 778-788-1455 | https://jkinman.github.io

PROFESSIONAL SUMMARY
Twenty years of building things people actually use. Led platform teams and shipped production workflows.

SKILLS
JavaScript, Node, React, Python, AWS

WORK EXPERIENCE
Disney | Senior Engineer | 2018-2024
Built internal tooling used across the org.

KEY STRENGTHS
Agentic AI integration specialist
>
Senior frontend engineer with 10+ years

EDUCATION
BSc Computer Science
`;

describe('resume import — scaffold', () => {
  it('keeps already-structured resume markdown untouched', () => {
    const md = '# Jane\n\n### Summary\nx\n\n### Skills\ny\n\n### Experience\nz';
    expect(scaffoldResumeMarkdown(md)).toBe(md);
    expect(looksLikeResumeMarkdown(md)).toBe(true);
  });

  it('wraps unstructured text into a section scaffold the parser accepts', () => {
    const scaffold = scaffoldResumeMarkdown('Jordan Lee\nNurse with 8 years experience', {
      filename: 'resume.pdf'
    });
    expect(scaffold).toContain('# Jordan Lee');
    expect(scaffold).toContain('### Summary');
    expect(scaffold).toContain('### Skills');
    expect(scaffold).toContain('### Experience');
    expect(scaffold).toContain('Imported from resume.pdf');
    expect(scaffold).toContain('Nurse with 8 years experience');
  });

  it('rejects empty extractions', () => {
    expect(() => scaffoldResumeMarkdown('   ')).toThrow(/no readable text/i);
  });
});

describe('resume import — section mapping', () => {
  it('maps a real resume layout into canonical sections', () => {
    const { content, structured } = structureResumeText(REAL_RESUME, { filename: 'cv.pdf' });

    expect(structured).toBe(true);
    expect(content).toContain('# Joel Kinman');
    expect(content).toContain('### Summary');
    expect(content).toContain('Twenty years of building things');
    expect(content).toContain('### Skills');
    expect(content).toContain('### Experience');
    expect(content).toContain('Disney');
    expect(content).toContain('### Education');
  });

  it('extracts contact details into parser-readable lines', () => {
    const { content } = structureResumeText(REAL_RESUME);
    expect(content).toContain('- **Email:** joel.kinman@gmail.com');
    expect(content).toContain('- **Website:** https://jkinman.github.io');
  });

  it('produces markdown the cv parser can read', () => {
    const { content } = structureResumeText(REAL_RESUME);
    const parsed = parseCVContent(content);

    expect(parsed.name).toBe('Joel Kinman');
    expect(parsed.summary).toContain('Twenty years');
    expect(parsed.email).toBe('joel.kinman@gmail.com');
    expect(parsed.experience[0]).toMatchObject({ company: 'Disney', role: 'Senior Engineer', date: '2018-2024' });
    expect(parsed.strengths).toContain('Agentic AI integration specialist');
  });

  it('falls back to a scaffold when no headings are detected', () => {
    const { content, structured } = structureResumeText('Just a blob of text with no sections at all');
    expect(structured).toBe(false);
    expect(content).toContain('### Summary');
  });
});

describe('resume import — real-world layout (tabs, CORE STRENGTHS)', () => {
  const RESUME = `JOEL KINMAN
Creative problem solver who loves to make cool stuff
Vancouver BC joel.kinman@gmail.com 778-788-1455 https://jkinman.github.io

SUMMARY
Twenty years of building things people actually use. Whatever the stack, end to end.

CORE STRENGTHS
Senior engineering judgment in AI-assisted development
Agentic AI integration specialist

EXPERIENCE
Highspot\tApr 2023 - Current
Senior Full Stack
Senior engineer at Highspot delivering AI features.
  Delivered LLM-enabled content generation.

Angry Mob\tCurrent
Founder / Principal Consultant
One-man development studio.
`;

  it('keeps CORE STRENGTHS out of the summary', () => {
    const parsed = parseCVContent(structureResumeText(RESUME).content);
    expect(parsed.summary).toContain('Twenty years');
    expect(parsed.summary).not.toMatch(/Senior engineering judgment/);
    expect(parsed.strengths).toContain('Senior engineering judgment in AI-assisted development');
  });

  it('parses tab-separated experience with the role on the next line', () => {
    const parsed = parseCVContent(structureResumeText(RESUME).content);
    expect(parsed.experience[0]).toMatchObject({
      company: 'Highspot',
      role: 'Senior Full Stack',
      date: 'Apr 2023 - Current'
    });
    expect(parsed.experience[1]).toMatchObject({ company: 'Angry Mob', role: 'Founder / Principal Consultant' });
  });

  it('does not mistake the all-caps name for a location', () => {
    const { content } = structureResumeText(RESUME);
    expect(content).not.toContain('- **Location:** JOEL KINMAN');
  });

  it('recovers contact when "City PROV" is glued onto a mashed email', () => {
    const mashed = `JOEL KINMAN
Tagline here
Vancouver BCjoel.kinman@gmail.com778-788-1455https://jkinman.github.io

SUMMARY
A short summary.

EXPERIENCE
HighspotApr 2023 - Current
Senior Full Stack
Did things.
`;
    const parsed = parseCVContent(structureResumeText(mashed).content);
    expect(parsed.email).toBe('joel.kinman@gmail.com');
    expect(parsed.location).toBe('Vancouver, BC');
    expect(parsed.experience[0]).toMatchObject({ company: 'Highspot', role: 'Senior Full Stack', date: 'Apr 2023 - Current' });
  });
});

describe('resume import — null bullets, hard wraps, tab-separated tech', () => {
  // Mirrors the gap-aware PDF renderer: bullet glyphs become \u0000, long lines
  // hard-wrap, and tag rows are tab-separated (recovered column gaps).
  const RESUME = `JOEL KINMAN
Creative problem solver who loves to make cool stuff. Almost two decades of
engineering experience.

SUMMARY
Twenty years of building things people actually use. Game dev origins, then
pivoted to full stack product development.

CORE STRENGTHS
Senior engineering judgment in AI-assisted
development
LLM-powered workflows, autonomous systems, and AI-
native product features

EXPERIENCE
Highspot\tApr 2023 - Current
Senior Full Stack
Senior engineer at Highspot delivering AI features across multiple teams while
stabilizing the platform.
Ruby\tReact\tLLM integrations
\u0000Delivered LLM-enabled content generation in production.

Appnovation\tJan 2020 - Jun 2021
Lead Frontend Developer
Led delivery of enterprise web applications across government and tourism
sectors.
React\tNext.js\tTypeScript\tNode\tPython
\u0000Led deployment of a healthcare tracking system to four Canadian
provinces.
\u0000Built ETL systems from headless CMS platforms (Contentful,
Drupal).
`;

  it('captures each job description and achievements', () => {
    const parsed = parseCVContent(structureResumeText(RESUME).content);
    expect(parsed.experience).toHaveLength(2);

    const [highspot] = parsed.experience;
    expect(highspot).toMatchObject({ company: 'Highspot', role: 'Senior Full Stack', date: 'Apr 2023 - Current' });
    expect(highspot.description).toContain('delivering AI features across multiple teams while stabilizing the platform');
    expect(highspot.highlights).toContain('Delivered LLM-enabled content generation in production.');
  });

  it('recovers tab-separated tech tags as technologies (TypeScript stays intact)', () => {
    const parsed = parseCVContent(structureResumeText(RESUME).content);
    expect(parsed.experience[0].technologies).toEqual(['Ruby', 'React', 'LLM integrations']);
    expect(parsed.experience[1].technologies).toEqual(['React', 'Next.js', 'TypeScript', 'Node', 'Python']);
  });

  it('keeps tech out of the description prose', () => {
    const { content } = structureResumeText(RESUME);
    expect(content).toContain('*Senior engineer at Highspot delivering AI features across multiple teams while stabilizing the platform.*');
  });

  it('rejoins hard-wrapped strengths and bullets', () => {
    const parsed = parseCVContent(structureResumeText(RESUME).content);
    expect(parsed.strengths).toContain('Senior engineering judgment in AI-assisted development');
    expect(parsed.strengths).toContain('LLM-powered workflows, autonomous systems, and AI-native product features');

    const appnovation = parsed.experience[1];
    expect(appnovation.highlights).toContain('Led deployment of a healthcare tracking system to four Canadian provinces.');
    expect(appnovation.highlights).toContain('Built ETL systems from headless CMS platforms (Contentful, Drupal).');
  });
});

describe('resume import — extraction', () => {
  it('reads plain text and markdown by extension', async () => {
    const buffer = Buffer.from('### Summary\nHello', 'utf8');
    expect(await extractText({ buffer, filename: 'cv.md' })).toContain('Hello');
    expect(await extractText({ buffer, filename: 'cv.txt' })).toContain('Hello');
  });

  it('reads plain text by mime type when extension is missing', async () => {
    const buffer = Buffer.from('plain resume body', 'utf8');
    expect(await extractText({ buffer, filename: 'resume', mimeType: 'text/plain' })).toContain('resume body');
  });

  it('rejects unsupported file types', async () => {
    await expect(
      extractText({ buffer: Buffer.from('x'), filename: 'resume.xyz', mimeType: 'application/x-thing' })
    ).rejects.toThrow(/unsupported file type/i);
  });

  it('rejects oversized files', async () => {
    const huge = Buffer.alloc(6 * 1024 * 1024, 0x20);
    await expect(extractText({ buffer: huge, filename: 'big.txt' })).rejects.toThrow(/too large/i);
  });

  it('imports a text file end-to-end', async () => {
    const buffer = Buffer.from('Casey Smith\nMarketing manager', 'utf8');
    const result = await importResumeFromFile({ buffer, filename: 'casey.txt', mimeType: 'text/plain' });
    expect(result.filename).toBe('casey.txt');
    expect(result.structured).toBe(false);
    expect(result.content).toContain('# Casey Smith');
  });
});
