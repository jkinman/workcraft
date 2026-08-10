'use client';

import { useState } from 'react';
import { resolveWorkloadResponse } from '../lib/client/job-polling';

const ACTIONS = [
  ['resume', '/api/generate-resume', 'EXPORT_RESUME_PDF'],
  ['coverLetter', '/api/generate-cover-letter', 'EXPORT_COVER_LETTER'],
  ['evalReport', '/api/generate-eval-report', 'EXPORT_ANALYSIS'],
  ['fullEval', '/api/generate-full-eval', 'EXPORT_FULL_EVAL']
];

export function JobActions({ company, role, slug, archetype }) {
  const [status, setStatus] = useState(null);
  const [busyAction, setBusyAction] = useState(null);

  async function runAction([id, endpoint]) {
    setBusyAction(id);
    setStatus(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role, slug, jobDescription: archetype || '' })
      });
      const data = await resolveWorkloadResponse(response, {
        onProgress: job => {
          if (job.status === 'queued' || job.status === 'running') {
            setStatus({ type: 'info', message: `Generating ${id} (${job.status})...` });
          }
        }
      });

      if (data.success) {
        setStatus({
          type: 'success',
          message: `${data.type || id} generated`,
          downloadUrl: data.downloadUrl
        });
      } else {
        setStatus({ type: 'error', message: data.error || 'Generation failed' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div>
      <div className="nav-buttons">
        {ACTIONS.map(action => (
          <button key={action[0]} className="btn" disabled={!!busyAction} onClick={() => runAction(action)} type="button">
            {busyAction === action[0] ? 'GENERATING...' : action[2]}
          </button>
        ))}
      </div>
      {status ? (
        <div className={`alert ${status.type}`}>
          {status.message}
          {status.downloadUrl ? (
            <>
              {' '}
              <a href={status.downloadUrl}>Download</a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
