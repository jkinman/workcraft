'use client';

import { useState } from 'react';

export function StateTransitionControls({ slug, nextStates }) {
  const [status, setStatus] = useState(null);
  const [busyState, setBusyState] = useState(null);

  async function transition(newState) {
    setBusyState(newState);
    setStatus(null);

    const response = await fetch('/api/transition-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, newState })
    });
    const data = await response.json();

    if (data.success) {
      setStatus({ type: 'success', message: `State updated: ${data.previous} -> ${data.state}` });
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setStatus({ type: 'error', message: data.error || 'State transition failed' });
    }

    setBusyState(null);
  }

  return (
    <div>
      <div className="nav-buttons">
        {nextStates.map(state => (
          <button key={state} className="btn" disabled={!!busyState} onClick={() => transition(state)} type="button">
            {busyState === state ? 'UPDATING...' : `-> ${state}`}
          </button>
        ))}
      </div>
      {status ? <div className={`alert ${status.type}`}>{status.message}</div> : null}
    </div>
  );
}
