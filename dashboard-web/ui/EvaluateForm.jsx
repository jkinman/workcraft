'use client';

import { useState } from 'react';
import { resolveWorkloadResponse } from '../lib/client/job-polling';

export function EvaluateForm() {
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const jdText = String(formData.get('jdText') || '').trim();
    const payload = {
      url: formData.get('url'),
      notes: formData.get('notes'),
    };
    if (jdText) payload.jdText = jdText;

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resolveWorkloadResponse(response, {
        onProgress: (job) => {
          if (job.status === 'queued' || job.status === 'running') {
            setStatus({ type: 'info', message: `Evaluation ${job.status}...` });
          }
        },
      });

      if (data.success) {
        setStatus({
          type: 'success',
          message: `Evaluated ${data.company} — ${data.role} (${data.score}/5)`,
          slug: data.slug,
        });
        event.currentTarget.reset();
      } else {
        setStatus({ type: 'error', message: data.error || 'Evaluation failed' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <label className="form-row">
        <span className="muted">JOB_POSTING_URL</span>
        <input className="input" name="url" type="url" placeholder="https://jobs.ashbyhq.com/..." />
      </label>
      <label className="form-row">
        <span className="muted">JD_TEXT (optional if URL provided)</span>
        <textarea className="input" name="jdText" rows={6} placeholder="Paste full job description here..." />
      </label>
      <label className="form-row">
        <span className="muted">NOTES</span>
        <input className="input" name="notes" type="text" placeholder="Priority, referrer, req id" />
      </label>
      <button className="btn btn-success" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'EVALUATING...' : 'RUN_EVALUATION'}
      </button>
      {status ? (
        <div className={`alert ${status.type}`}>
          {status.message}
          {status.slug ? (
            <>
              {' '}
              <a href={`/job/${status.slug}`}>View report</a>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
