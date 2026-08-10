const DEFAULT_INTERVAL_MS = 1500;
// Allow enough time for queued deep-dive scans, whose worker timeout is five minutes.
const DEFAULT_MAX_ATTEMPTS = 400;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJobStatus(pollUrl) {
  const response = await fetch(pollUrl);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Job poll failed (${response.status})`);
  }

  return data;
}

async function pollJob(pollUrl, {
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  onProgress
} = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await fetchJobStatus(pollUrl);
    onProgress?.(data);

    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }

    await sleep(intervalMs);
  }

  throw new Error('Job polling timed out');
}

function isHostedJobResponse(data) {
  return data?.mode === 'hosted-job' && Boolean(data?.pollUrl);
}

async function resolveWorkloadResponse(initialResponse, options = {}) {
  const data = await initialResponse.json();

  if (!initialResponse.ok || data.success === false) {
    throw new Error(data.error || 'Request failed');
  }

  if (!isHostedJobResponse(data)) {
    return data;
  }

  const finalJob = await pollJob(data.pollUrl, options);
  if (finalJob.status === 'failed') {
    throw new Error(finalJob.error || 'Background job failed');
  }

  return {
    ...data,
    ...finalJob,
    ...(finalJob.result || {})
  };
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  DEFAULT_MAX_ATTEMPTS,
  fetchJobStatus,
  isHostedJobResponse,
  pollJob,
  resolveWorkloadResponse
};
