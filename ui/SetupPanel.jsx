'use client';

import { useState } from 'react';

const LABELS = {
  cv: 'cv.md',
  profile: 'config/profile.yml',
  portals: 'portals.yml',
  pipeline: 'data/pipeline.md'
};

export function SetupPanel({ status, title = 'First-run setup' }) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState(null);
  const [busyTarget, setBusyTarget] = useState(null);

  if (!currentStatus?.missing?.length) return null;

  async function initialize(target) {
    setBusyTarget(target);
    setMessage(null);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      const data = await response.json();

      if (!data.success) {
        setMessage({ type: 'error', text: data.error || 'Setup failed' });
      } else {
        setCurrentStatus(data.status);
        setMessage({
          type: 'success',
          text: data.initialized.length
            ? `Initialized ${data.initialized.join(', ')}.`
            : 'Defaults already initialized.'
        });
        setTimeout(() => window.location.reload(), 700);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusyTarget(null);
    }
  }

  return (
    <div className="card">
      <strong>{title}</strong>
      <p className="muted">
        Some local setup files are missing. Initialize defaults to continue testing this tenant locally.
      </p>
      <div className="activity-list">
        {Object.entries(currentStatus.files).map(([key, exists]) => (
          <div className="activity-row" key={key}>
            <span>{LABELS[key] || key}</span>
            <strong className={exists ? 'status-applied' : 'status-rejected'}>
              {exists ? 'READY' : 'MISSING'}
            </strong>
          </div>
        ))}
      </div>
      <div className="nav-buttons">
        {!currentStatus.files.portals ? (
          <button className="btn" disabled={!!busyTarget} onClick={() => initialize('portals')} type="button">
            {busyTarget === 'portals' ? 'INITIALIZING...' : 'USE_DEFAULT_PORTALS'}
          </button>
        ) : null}
        {!currentStatus.files.profile ? (
          <button className="btn" disabled={!!busyTarget} onClick={() => initialize('profile')} type="button">
            {busyTarget === 'profile' ? 'INITIALIZING...' : 'USE_DEFAULT_PROFILE'}
          </button>
        ) : null}
        {!currentStatus.files.pipeline ? (
          <button className="btn" disabled={!!busyTarget} onClick={() => initialize('pipeline')} type="button">
            {busyTarget === 'pipeline' ? 'INITIALIZING...' : 'CREATE_PIPELINE'}
          </button>
        ) : null}
        <button className="btn btn-success" disabled={!!busyTarget} onClick={() => initialize('all')} type="button">
          {busyTarget === 'all' ? 'INITIALIZING...' : 'INITIALIZE_ALL_DEFAULTS'}
        </button>
      </div>
      {message ? <div className={`alert ${message.type}`}>{message.text}</div> : null}
    </div>
  );
}
