'use client';

import { useState } from 'react';
import { resolveWorkloadResponse } from '../lib/client/job-polling';

export function ScanControls({ disabled = false }) {
  const [status, setStatus] = useState(null);
  const [busyMode, setBusyMode] = useState(null);

  async function runScan(mode) {
    if (disabled) {
      setStatus({ type: 'error', message: 'Scanner setup is incomplete. Initialize defaults first.' });
      return;
    }

    setBusyMode(mode);
    setStatus({ type: 'info', message: `Running ${mode} scan...` });

    const params = new URLSearchParams();
    if (mode === 'dry-run') params.set('dryRun', 'true');
    if (mode === 'deep-dive') params.set('deepDive', 'true');

    try {
      const response = await fetch(`/api/scan?${params.toString()}`, { method: 'POST' });
      const data = await resolveWorkloadResponse(response, {
        onProgress: job => {
          if (job.status === 'queued' || job.status === 'running') {
            setStatus({ type: 'info', message: `Scan ${job.status}...` });
          }
        }
      });

      setStatus({
        type: 'success',
        message: `Scan complete. Found ${data.totalFound || 0}, new ${data.newOffers || 0}.`
      });
      if (mode !== 'dry-run') setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <div className="card">
      <div className="nav-buttons">
        <button className="btn btn-success" disabled={disabled || !!busyMode} onClick={() => runScan('full')} type="button">
          RUN_FULL_SCAN
        </button>
        <button className="btn" disabled={disabled || !!busyMode} onClick={() => runScan('dry-run')} type="button">
          DRY_RUN
        </button>
        <button className="btn btn-warning" disabled={disabled || !!busyMode} onClick={() => runScan('deep-dive')} type="button">
          DEEP_DIVE
        </button>
      </div>
      {status ? <div className={`alert ${status.type === 'error' ? 'error' : 'success'}`}>{status.message}</div> : null}
    </div>
  );
}
