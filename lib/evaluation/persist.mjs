/**
 * Report persistence and tracker integration for evaluations.
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { stripScoreSummary } from './score-summary.mjs';
import { buildEvaluationReportHeader, NO_POSTING_URL_SENTINEL } from './source-url.mjs';

async function loadReportAllocator() {
  return import('../../reserve-report-num.mjs');
}

export function slugifyCompany(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

export function tsvSafe(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

export function normalizedTrackerScore(value) {
  const clean = tsvSafe(value);
  if (!clean || clean === '?') return 'N/A';
  return /\/5$/i.test(clean) ? clean : `${clean}/5`;
}

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {string} params.reportsDir
 * @param {string} params.evaluationText
 * @param {import('./score-summary.mjs').ScoreSummary} params.summary
 * @param {string} params.toolLine
 * @param {string} params.sourceUrl
 * @param {'hint' | 'tsv' | 'tsv-merge'} [params.trackerMode]
 * @param {string} [params.trackerNote]
 * @param {string} [params.trackerAdditionsDir]
 * @param {string} [params.mergeTrackerScript]
 */
export async function persistEvaluationReport({
  rootDir,
  reportsDir,
  evaluationText,
  summary,
  toolLine,
  sourceUrl = NO_POSTING_URL_SENTINEL,
  trackerMode = 'hint',
  trackerNote = '',
  trackerAdditionsDir,
  mergeTrackerScript,
  env = process.env,
}) {
  let reservedNumbers = [];
  const result = {
    saved: false,
    filename: null,
    reportPath: null,
    num: null,
    trackerPath: null,
    trackerHint: null,
    mergeOutput: null,
    exitCode: 0,
  };

  try {
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const { formatReportNumber, releaseReportNumbers, reserveReportNumbers } = await loadReportAllocator();
    reservedNumbers = await reserveReportNumbers(1, { rootDir, reportsDir, env });
    const num = formatReportNumber(reservedNumbers[0]);
    const today = new Date().toISOString().split('T')[0];
    const companySlug = slugifyCompany(summary.company);
    const filename = `${num}-${companySlug}-${today}.md`;
    const reportPath = join(reportsDir, filename);

    const reportContent = `${buildEvaluationReportHeader({
      date: today,
      company: summary.company,
      role: summary.role,
      archetype: summary.archetype,
      score: summary.score,
      sourceUrl,
      legitimacy: summary.legitimacy,
      toolLine,
    })}
---

${stripScoreSummary(evaluationText)}
`;

    writeFileSync(reportPath, reportContent, 'utf-8');
    result.saved = true;
    result.filename = filename;
    result.reportPath = reportPath;
    result.num = num;

    if (trackerMode === 'hint') {
      result.trackerHint =
        `| ${num} | ${today} | ${summary.company} | ${summary.role} | ${summary.score}/5 | Evaluated | ❌ | [${num}](reports/${filename}) |`;
    } else if (trackerMode === 'tsv' || trackerMode === 'tsv-merge') {
      const additionsDir = trackerAdditionsDir ?? join((env.CAREER_OPS_DATA_ROOT || rootDir), 'batch', 'tracker-additions');
      mkdirSync(additionsDir, { recursive: true });
      const trackerPath = join(additionsDir, `${num}-${companySlug}.tsv`);
      const trackerFields = [
        String(parseInt(num, 10)),
        today,
        tsvSafe(summary.company),
        tsvSafe(summary.role),
        'Evaluated',
        normalizedTrackerScore(summary.score),
        '❌',
        `[${num}](reports/${filename})`,
        trackerNote || 'evaluation',
      ];
      writeFileSync(trackerPath, `${trackerFields.join('\t')}\n`, 'utf-8');
      result.trackerPath = trackerPath;

      if (trackerMode === 'tsv-merge' && mergeTrackerScript) {
        try {
          const mergeOutput = execFileSync(process.execPath, [mergeTrackerScript], {
            cwd: rootDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          result.mergeOutput = mergeOutput.trim();
        } catch (err) {
          result.exitCode = 1;
          result.mergeError = err.message;
        }
      }
    }
  } catch (err) {
    result.error = err.message;
  } finally {
    if (reservedNumbers.length > 0) {
      try {
        const { releaseReportNumbers } = await loadReportAllocator();
        await releaseReportNumbers(reservedNumbers, { rootDir, reportsDir, env });
      } catch (err) {
        result.releaseError = err.message;
      }
    }
  }

  return result;
}
