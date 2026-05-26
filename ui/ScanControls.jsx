'use client';

import { useState } from 'react';

export function ScanControls() {
  const [status, setStatus] = useState(null);
  const [busyMode, setBusyMode] = useState(null);

  async function runScan(mode) {
    setBusyMode(mode);
    setStatus({ type: 'info', message: `Running ${mode} scan...` });

    const params = new URLSearchParams();
    if (mode === 'dry-run') params.set('dryRun', 'true');
    if (mode === 'deep-dive') params.set('deepDive', 'true');

    try {
      const response = await fetch(`/api/scan?${params.toString()}`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Scan failed' });
      } else {
        setStatus({
          type: 'success',
          message: `Scan complete. Found ${data.totalFound || 0}, new ${data.newOffers || 0}.`
        });
        if (mode !== 'dry-run') setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <div className="card">
      <div className="nav-buttons">
        <button className="btn btn-success" disabled={!!busyMode} onClick={() => runScan('full')} type="button">
          RUN_FULL_SCAN
        </button>
        <button className="btn" disabled={!!busyMode} onClick={() => runScan('dry-run')} type="button">
          DRY_RUN
        </button>
        <button className="btn btn-warning" disabled={!!busyMode} onClick={() => runScan('deep-dive')} type="button">
          DEEP_DIVE
        </button>
      </div>
      {status ? <div className={`alert ${status.type === 'error' ? 'error' : 'success'}`}>{status.message}</div> : null}
    </div>
  );
}
