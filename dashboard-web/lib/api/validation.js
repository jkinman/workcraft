const VALID_STATES = new Set(['discovered', 'researching', 'evaluated', 'applied', 'interviewing', 'offer', 'closed']);
const { jsonError, jsonNotFound, jsonSuccess } = require('./responses');

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function validateUrl(value) {
  const url = requireString(value, 'URL');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }
  return parsed.toString();
}

function validateState(value) {
  const state = requireString(value, 'newState').toLowerCase();
  if (!VALID_STATES.has(state)) {
    throw new Error(`Invalid state: ${state}`);
  }
  return state;
}

module.exports = {
  jsonError,
  jsonNotFound,
  jsonSuccess,
  requireString,
  validateState,
  validateUrl
};
