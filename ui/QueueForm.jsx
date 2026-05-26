'use client';

import { useState } from 'react';

export function QueueForm() {
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: formData.get('url'),
        notes: formData.get('notes')
      })
    });
    const data = await response.json();

    if (data.success) {
      setStatus({ type: 'success', message: `Queued ${data.entry.company} - ${data.entry.role}` });
      event.currentTarget.reset();
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to queue job' });
    }

    setIsSubmitting(false);
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <label className="form-row">
        <span className="muted">JOB_POSTING_URL *</span>
        <input className="input" name="url" type="url" required placeholder="https://jobs.ashbyhq.com/..." />
      </label>
      <label className="form-row">
        <span className="muted">NOTES</span>
        <input className="input" name="notes" type="text" placeholder="Role title, referrer, priority" />
      </label>
      <button className="btn btn-success" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'QUEUEING...' : 'QUEUE_FOR_EVALUATION'}
      </button>
      {status ? <div className={`alert ${status.type}`}>{status.message}</div> : null}
    </form>
  );
}
