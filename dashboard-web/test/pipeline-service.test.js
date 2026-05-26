import { describe, expect, it } from 'vitest';
import pipelineService from '../lib/services/pipeline-service';

const {
  addEntryToPipelineContent,
  inferPipelineEntry,
  parsePipelineContent
} = pipelineService;

describe('pipeline service', () => {
  it('parses pending and completed jobs from markdown', () => {
    const pipeline = parsePipelineContent(`
## Pending

- [ ] https://jobs.ashbyhq.com/acme/123 | Acme | Staff Engineer

## Applied

- [x] https://jobs.example.com/role | Example | Frontend Engineer
`);

    expect(pipeline.total).toBe(2);
    expect(pipeline.pending[0]).toMatchObject({
      company: 'Acme',
      role: 'Staff Engineer',
      status: 'pending'
    });
    expect(pipeline.applied[0].status).toBe('done');
  });

  it('infers company and role from supported job URLs and notes', () => {
    const entry = inferPipelineEntry('https://jobs.ashbyhq.com/workcraft/a1', 'Staff Frontend - remote');

    expect(entry).toMatchObject({
      company: 'Workcraft',
      role: 'Staff Frontend'
    });
  });

  it('adds entries to the pending section without removing existing content', () => {
    const next = addEntryToPipelineContent('# Pipeline\n\n## Pending\n\n', {
      url: 'https://example.com/job',
      company: 'Example',
      role: 'Engineer',
      notes: ''
    });

    expect(next).toContain('- [ ] https://example.com/job | Example | Engineer');
    expect(next).toContain('## Pending');
  });
});
