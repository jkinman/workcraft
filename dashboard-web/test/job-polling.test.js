import { describe, expect, it, vi } from 'vitest';
import { isHostedJobResponse, pollJob } from '../lib/client/job-polling';

describe('job polling client', () => {
  it('detects hosted job responses', () => {
    expect(isHostedJobResponse({ mode: 'hosted-job', pollUrl: '/api/jobs/1' })).toBe(true);
    expect(isHostedJobResponse({ mode: 'local-cli', status: 'completed' })).toBe(false);
  });

  it('polls until terminal status with bounded attempts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, status: 'running' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        status: 'completed',
        result: { downloadUrl: '/download-pdf?file=cv.pdf' }
      }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const finalJob = await pollJob('/api/jobs/job-1', { intervalMs: 1, maxAttempts: 5 });
    expect(finalJob.status).toBe('completed');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });
});
