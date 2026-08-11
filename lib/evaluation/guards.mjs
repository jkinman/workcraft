/**
 * Endpoint security guards for evaluation providers.
 */

/**
 * @param {string} baseUrl
 * @returns {{ host: string, isLoopback: boolean }}
 */
export function parseEndpointHost(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid base URL: "${baseUrl}"`);
  }
  const host = parsed.hostname;
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return { host, isLoopback, protocol: parsed.protocol };
}

/**
 * @param {object} params
 * @param {string} params.baseUrl
 * @param {string} [params.apiKey]
 * @param {string} [params.providerLabel]
 */
export function assertHostedOpenAiEndpoint({ baseUrl, apiKey, providerLabel = 'endpoint' }) {
  const { host, isLoopback, protocol } = parseEndpointHost(baseUrl);

  if (!isLoopback && protocol !== 'https:') {
    throw new Error(
      `Refusing to use a non-HTTPS remote ${providerLabel}: ${baseUrl}\n` +
      '   Your CV, the job description, and your API key would be sent in cleartext.\n' +
      '   Use an https:// endpoint, or http://localhost:... for a local server.',
    );
  }

  if (!isLoopback && !apiKey) {
    throw new Error(
      `No API key for ${host}.\n` +
      '   Set OPENAI_API_KEY (or pass --key). Local servers at localhost may not need one.',
    );
  }

  return { host, isLoopback };
}

/**
 * @param {object} params
 * @param {string} params.baseUrl
 * @param {Record<string, string>} [params.env]
 */
export function assertOllamaLoopback({ baseUrl, env = process.env }) {
  const { host, isLoopback } = parseEndpointHost(baseUrl);
  if (!isLoopback && env.OLLAMA_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Remote Ollama endpoint detected: ${baseUrl}\n\n` +
      '   Your CV and job description would be sent to a remote server.\n' +
      '   This tool is designed for local use only.\n\n' +
      '   If you intentionally want to use a remote endpoint, set:\n' +
      '     OLLAMA_ALLOW_REMOTE=1 node ollama-eval.mjs ...',
    );
  }
  return { host, isLoopback };
}

/**
 * @param {number} timeoutMs
 * @param {string} [envValue]
 */
export function parseTimeoutMs(envValue, defaultMs = 300_000) {
  const timeoutMs = parseInt(envValue ?? String(defaultMs), 10);
  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout: "${envValue}" — must be a positive integer (milliseconds).`);
  }
  return timeoutMs;
}
