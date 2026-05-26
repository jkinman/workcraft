import { describe, expect, it } from 'vitest';
import reportParser from '../report-parser';

const { parseReport, renderMarkdownToHtml, slugify } = reportParser;

describe('report parser', () => {
  it('parses report metadata and score', () => {
    const report = parseReport(`# Evaluation: Acme - Staff Engineer

**Date:** 2026-05-25
**URL:** https://jobs.ashbyhq.com/acme/abc-123
**Score:** 4.6/5

## A) Role Summary
| **Compensation** | CAD 180k |
| **Location** | Remote Canada |

## Final Recommendation
**APPLY NOW**
`, '001-acme-2026-05-25.md');

    expect(report).toMatchObject({
      company: 'Acme',
      role: 'Staff Engineer',
      score: 4.6,
      verdict: 'APPLY NOW',
      comp: 'CAD 180k',
      location: 'Remote Canada'
    });
  });

  it('uses report number in slugs for stable unique routes', () => {
    expect(slugify('Acme Inc.', '#', '042-acme-inc-role.md')).toBe('acme-inc-042');
  });

  it('sanitizes rendered markdown html', () => {
    const html = renderMarkdownToHtml('# Hi\n\n<script>alert("x")</script>\n\n[link](javascript:alert(1))');

    expect(html).toContain('<h1>Hi</h1>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
  });
});
