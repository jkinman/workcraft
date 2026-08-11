/**
 * Canonical application state transition — tracker, report frontmatter, status log.
 */

import trackerContract from '../../templates/tracker-contract.json' with { type: 'json' };
import {
  resolveColumns,
  parseTrackerRow,
  extractTrackerReportNumbers,
  normalizeTextKey,
} from '../../tracker-parse.mjs';
import { applyTrackerRowMutation } from './mutate.mjs';
import { appendStatusLogEntry } from './status-log.mjs';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n\n?/;
const CANONICAL_STATES = trackerContract.states;

function normalizeCompany(name) {
  return normalizeTextKey(name);
}

function resolveCanonicalState(input, states = CANONICAL_STATES) {
  const clean = String(input ?? '').replace(/\*\*/g, '').trim().toLowerCase();
  if (!clean) return null;
  for (const state of states) {
    if (state.label.toLowerCase() === clean) return state.label;
    if (state.id.toLowerCase() === clean) return state.label;
    if (state.aliases.some((alias) => alias.toLowerCase() === clean)) return state.label;
  }
  return null;
}

/** Await sync or async dataClient method results uniformly. */
async function invoke(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  return await Promise.resolve(fn(...args));
}

function parseFrontmatter(content) {
  const fm = { state: 'evaluated', state_history: [] };
  const match = content.match(FRONTMATTER_RE);
  if (!match) return fm;
  const yaml = match[1];
  const stateMatch = yaml.match(/^state:\s*(\S+)/m);
  if (stateMatch) fm.state = stateMatch[1].trim().toLowerCase();
  const historyMatch = yaml.match(/^state_history:\s*\n((?:  - .+\n?)+)/m);
  if (historyMatch) {
    fm.state_history = historyMatch[1].trim().split('\n').map((line) => {
      const m = line.match(/state:\s*"?([^",\s]+)"?.*date:\s*"?([^"\s}]+)"?/);
      return m ? { state: m[1], date: m[2] } : null;
    }).filter(Boolean);
  }
  return fm;
}

function buildFrontmatter(state, history) {
  const historyYaml = history.map(h => `  - {state: ${String(h.state).replace(/"/g, '')}, date: "${h.date}"}`).join('\n');
  return `---\nstate: ${state}\nstate_history:\n${historyYaml}\n---\n\n`;
}

function reportBasename(filename) {
  return String(filename || '').replace(/^.*[/\\]/, '').replace(/\.md$/i, '');
}

function reportNumberFromBasename(basename) {
  const m = basename.match(/^0*(\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

async function findReportFile(dataClient, slug) {
  const normalizedSlug = String(slug || '').toLowerCase();
  const files = await invoke(dataClient.listReports.bind(dataClient)) ?? [];
  for (const file of files) {
    const base = reportBasename(file.filename).toLowerCase();
    if (base === normalizedSlug || base.includes(normalizedSlug)) return file.filename;
  }
  for (const file of files) {
    const base = reportBasename(file.filename).toLowerCase();
    const parts = base.split('-');
    const possibleCompany = parts[1];
    if (possibleCompany && normalizedSlug.startsWith(possibleCompany)) return file.filename;
  }
  return null;
}

function findTrackerRowByReportLink(rows, reportFilename) {
  const basename = reportBasename(reportFilename);
  const reportNum = reportNumberFromBasename(basename);

  for (const row of rows) {
    const cell = String(row.report ?? '');
    if (cell.includes(basename)) return row;
    if (reportNum != null) {
      const nums = extractTrackerReportNumbers(cell);
      if (nums.includes(reportNum)) return row;
    }
  }
  return null;
}

function findTrackerRowByCompany(rows, company) {
  const key = normalizeCompany(company);
  return rows.find(r => normalizeCompany(r.company) === key) || null;
}

function companyFromEvaluationHeading(content) {
  const match = content.match(/^#\s*Evaluation:\s*(.+?)(?:\s*[—–-]\s*|\s*$)/im);
  if (!match) return null;
  return match[1].trim();
}

function companyFromReportMetadata(content) {
  const heading = companyFromEvaluationHeading(content);
  if (heading) return heading;
  const companyMatch = content.match(/\*\*Company:\*\*\s*(.+)/i);
  return companyMatch ? companyMatch[1].trim() : null;
}

function trackerDocumentPath(dataClient) {
  if (typeof dataClient.trackerDocumentPath === 'function') {
    return dataClient.trackerDocumentPath();
  }
  return 'data/applications.md';
}

function reportDocumentKey(dataClient, reportFilename) {
  const safeName = String(reportFilename || '').replace(/^.*[/\\]/, '');
  if (typeof dataClient.repository?.reportsDir === 'function') {
    return `${dataClient.repository.reportsDir()}/${safeName}`;
  }
  return `reports/${safeName}`;
}

/**
 * @param {import('../../dashboard-web/lib/data/career-ops-data-client.js').CareerOpsDataClient} dataClient
 * @param {object} params
 */
export async function transitionApplicationState(dataClient, {
  slug,
  newState,
  note = null,
  source = 'dashboard',
  today = new Date().toISOString().slice(0, 10),
}) {
  const canonical = resolveCanonicalState(newState);
  if (!canonical) {
    return { success: false, error: `Invalid state: ${newState}` };
  }

  const reportFilename = await findReportFile(dataClient, slug);
  if (!reportFilename) {
    return { success: false, error: `Report not found for slug: ${slug}` };
  }

  const reportContent = (await invoke(dataClient.readReport.bind(dataClient), reportFilename)) || '';
  const fm = parseFrontmatter(reportContent);
  const previous = fm.state;
  const history = [...fm.state_history, { state: canonical.toLowerCase(), date: today }];
  const nextReport = reportContent.startsWith('---\n')
    ? reportContent.replace(FRONTMATTER_RE, buildFrontmatter(canonical.toLowerCase(), history))
    : buildFrontmatter(canonical.toLowerCase(), history) + reportContent;

  const trackerKey = trackerDocumentPath(dataClient);
  const trackerContent = await invoke(dataClient.readApplications.bind(dataClient));
  if (!trackerContent) {
    return { success: false, error: 'applications.md not found for tenant' };
  }

  const lines = trackerContent.split('\n');
  const colmap = resolveColumns(lines);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const row = parseTrackerRow(lines[i], colmap);
    if (row) rows.push({ ...row, lineIdx: i });
  }

  let target = findTrackerRowByReportLink(rows, reportFilename);
  if (!target) {
    const companyHint = companyFromReportMetadata(reportContent);
    if (companyHint) target = findTrackerRowByCompany(rows, companyHint);
  }
  if (!target) {
    return { success: false, error: `No tracker row matched report ${reportFilename}` };
  }

  const logBefore = dataClient.readStatusLog
    ? await invoke(dataClient.readStatusLog.bind(dataClient))
    : null;

  const reportKey = reportDocumentKey(dataClient, reportFilename);

  let statusLogMutated = false;
  let txn = null;
  let mutation = null;
  try {
    mutation = applyTrackerRowMutation({
      lines: [...lines],
      target,
      colmap,
      newStatus: canonical,
      note,
    });

    const mutations = [{ key: reportKey, content: nextReport }];
    if (mutation.changed) {
      mutations.unshift({ key: trackerKey, content: mutation.lines.join('\n') });
    }

    txn = await dataClient.mutateDocuments(mutations);

    if (mutation.statusChanged) {
      await appendStatusLogEntry({
        trackerPath: trackerKey,
        trackerNum: target.num,
        date: today,
        fromStatus: mutation.oldStatus,
        toStatus: canonical,
        source,
        writeFn: (content) => invoke(dataClient.appendStatusLog.bind(dataClient), content),
        readExists: async () => Boolean(await invoke(dataClient.readStatusLog?.bind(dataClient))),
      });
      statusLogMutated = true;
    }

    return {
      success: true,
      state: canonical.toLowerCase(),
      previous,
      history,
      trackerNum: target.num,
      changed: mutation.changed,
      statusLogged: mutation.statusChanged,
    };
  } catch (err) {
    if (txn?.rollback) {
      await txn.rollback();
    }
    if (logBefore != null && dataClient.writeStatusLog) {
      await invoke(dataClient.writeStatusLog.bind(dataClient), logBefore);
    } else if (statusLogMutated) {
      if (typeof dataClient.deleteStatusLog === 'function') {
        await invoke(dataClient.deleteStatusLog.bind(dataClient));
      } else if (dataClient.writeStatusLog) {
        await invoke(dataClient.writeStatusLog.bind(dataClient), '');
      }
    }
    return { success: false, error: err.message };
  }
}

export { parseFrontmatter, buildFrontmatter, findTrackerRowByReportLink, companyFromEvaluationHeading };
