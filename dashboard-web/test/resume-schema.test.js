import { describe, expect, it } from 'vitest';
import { parseCVContent } from '../cv-parser';
import { cvObjectToMarkdown, cvToObject, emptyResume } from '../lib/services/resume-schema';

const MARKDOWN = `# Joel Kinman
## Creative problem solver

- **Location:** Vancouver, BC
- **Email:** joel@example.com
- **Phone:** 778-555-1234
- **Website:** https://example.com
- **LinkedIn:** https://linkedin.com/in/joel

### Summary
Twenty years of building things people use.

### Strengths
- Senior engineering judgment
- Ships fast without breaking things

### Skills
- **Frontend (90/100):** React, Next.js
- **Backend (90/100):** Node, Python

### Experience
**Highspot** | Senior Full Stack | Apr 2023 - Current
*Senior engineer delivering AI features.*
- Delivered LLM content generation.
- Technologies: Ruby, React, LLM

**Article** | Senior Frontend Developer | Jun 2021 - Aug 2022
*Built design-to-code pipelines.*
- Created multi-theme component system.
- Technologies: Node, TypeScript, Vue
`;

describe('resume-schema — cvToObject', () => {
  it('maps markdown into the structured shape', () => {
    const obj = cvToObject(MARKDOWN);
    expect(obj.name).toBe('Joel Kinman');
    expect(obj.tagline).toBe('Creative problem solver');
    expect(obj.contact).toEqual({
      location: 'Vancouver, BC',
      email: 'joel@example.com',
      phone: '778-555-1234',
      website: 'https://example.com',
      linkedin: 'https://linkedin.com/in/joel'
    });
    expect(obj.summary).toContain('Twenty years');
    expect(obj.strengths).toHaveLength(2);
    expect(obj.skills.frontend).toEqual(['React', 'Next.js']);
    expect(obj.experience).toHaveLength(2);
    expect(obj.experience[0]).toMatchObject({
      company: 'Highspot',
      role: 'Senior Full Stack',
      date: 'Apr 2023 - Current',
      description: 'Senior engineer delivering AI features.',
      highlights: ['Delivered LLM content generation.'],
      technologies: ['Ruby', 'React', 'LLM']
    });
  });

  it('returns an empty resume for blank input', () => {
    expect(cvToObject('')).toEqual(emptyResume());
  });
});

describe('resume-schema — round trip', () => {
  it('object -> markdown -> object is stable', () => {
    const obj = cvToObject(MARKDOWN);
    const markdown = cvObjectToMarkdown(obj);
    const reparsed = cvToObject(markdown);
    expect(reparsed).toEqual(obj);
  });

  it('produces markdown the cv parser fully reads (description + highlights + tech)', () => {
    const obj = cvToObject(MARKDOWN);
    const parsed = parseCVContent(cvObjectToMarkdown(obj));
    expect(parsed.experience[0].description).toBe('Senior engineer delivering AI features.');
    expect(parsed.experience[0].highlights).toContain('Delivered LLM content generation.');
    expect(parsed.experience[0].technologies).toEqual(['Ruby', 'React', 'LLM']);
    expect(parsed.skills.frontend).toEqual(['React', 'Next.js']);
  });

  it('serializes a hand-built object with required sections', () => {
    const markdown = cvObjectToMarkdown({
      ...emptyResume(),
      name: 'A B',
      summary: 'Hi',
      experience: [{ company: 'X', role: 'Dev', date: '2020', description: '', highlights: ['Did a thing'], technologies: [] }]
    });
    expect(markdown).toContain('### Summary');
    expect(markdown).toContain('### Skills');
    expect(markdown).toContain('### Experience');
    expect(markdown).toContain('**X** | Dev | 2020');
  });
});
