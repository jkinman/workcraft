const yaml = require('js-yaml');
const { jsonError, jsonNotFound, jsonSuccess } = require('./responses');
const { STATE_META } = require('../workflow-states');

const VALID_STATES = new Set(Object.keys(STATE_META));

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function requireNonEmpty(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function validateYaml(value, fieldName) {
  const content = requireNonEmpty(value, fieldName);
  try {
    yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid ${fieldName}: ${error.message}`);
  }
  return content;
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
  requireNonEmpty,
  requireString,
  validateState,
  validateUrl,
  validateYaml
};
