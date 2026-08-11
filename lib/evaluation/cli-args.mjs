/**
 * Shared CLI argument parsing for headless evaluators.
 */

import { readFileSync, existsSync } from 'fs';

/**
 * @param {string[]} args
 * @param {object} [defaults]
 */
export function parseCommonEvalArgs(args, defaults = {}) {
  let jdText = '';
  let modelName = defaults.model ?? '';
  let saveReport = defaults.saveReport ?? true;
  let noCompress = false;
  let baseUrl = defaults.baseUrl;
  let apiKey = defaults.apiKey;
  let jobUrl = '';
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      const filePath = args[++i];
      if (!existsSync(filePath)) {
        return { error: `❌  File not found: ${filePath}`, exitCode: 1 };
      }
      try {
        jdText = readFileSync(filePath, 'utf-8').trim();
      } catch (err) {
        return { error: `❌  Could not read file: ${filePath}\n    ${err.message}`, exitCode: 1 };
      }
    } else if (args[i] === '--job-url' && args[i + 1]) {
      jobUrl = args[++i];
    } else if (args[i] === '--model' && args[i + 1]) {
      modelName = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[++i].replace(/\/$/, '');
    } else if (args[i] === '--key' && args[i + 1]) {
      apiKey = args[++i];
    } else if (args[i] === '--no-save') {
      saveReport = false;
    } else if (args[i] === '--no-compress') {
      noCompress = true;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
      jdText += (jdText ? '\n' : '') + args[i];
    }
  }

  if (!jdText) {
    return { error: '❌  No Job Description provided. Run with --help for usage.', exitCode: 1 };
  }

  const argvPostingUrl = positional.length === 1 ? positional[0] : '';

  return {
    jdText,
    modelName,
    saveReport,
    noCompress,
    baseUrl,
    apiKey,
    jobUrl,
    argvPostingUrl,
  };
}

/**
 * @param {string} name
 */
export function loadDotenvOptional(name = 'dotenv') {
  try {
    return import(name).then(({ config }) => config());
  } catch {
    return Promise.resolve();
  }
}
