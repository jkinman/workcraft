/**
 * ESM bridge for dashboard-web (CJS) → lib/tracker transition-sync.
 */

async function transitionApplicationState(dataClient, params) {
  const mod = await import('../../lib/tracker/transition-sync.mjs');
  return mod.transitionApplicationState(dataClient, params);
}

module.exports = {
  transitionApplicationState,
};
