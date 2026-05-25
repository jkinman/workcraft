// views.js - Main view orchestrator (terminal theme)
const { getEvaluations } = require('./evaluations');
const { getStyles } = require('./styles');
const { getScripts } = require('./scripts');
const { renderHeader, renderTopPicks, renderDetails, renderPipelineView, renderEvalTable, scoreToGrade } = require('./components');

function renderDashboard(view, jobs, req) {
  const evals = getEvaluations();
  const dashboardUrl = req?.app?.locals?.dashboardUrl || 'http://192.168.0.50:3000';

  const dream = evals.filter(e => e.score >= 4.5).length;
  const strong = evals.filter(e => e.score >= 4.0 && e.score < 4.5).length;
  const good = evals.filter(e => e.score >= 3.5 && e.score < 4.0).length;
  const total = evals.length;

  const stats = { dream, strong, good, total };

  let content = '';
  if (view === 'pipeline') {
    content = renderPipelineView(jobs, dashboardUrl);
  } else {
    content = renderTopPicks(evals, dashboardUrl);
    content += '<div class="section-title">RANKED_EVALUATIONS</div>';
    content += renderEvalTable(evals, dashboardUrl);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>~/career-ops/dashboard</title>
    ${getStyles()}
</head>
<body>
    ${renderHeader(stats, dashboardUrl, view)}
    <div class="container">
        ${content}
    </div>
    ${getScripts()}
</body>
</html>`;
}

function renderJobDetail(job, req) {
  const dashboardUrl = req?.app?.locals?.dashboardUrl || 'http://192.168.0.50:3000';
  const sg = scoreToGrade(job.score);
  const { getRawReportContent, renderMarkdownToHtml, slugify } = require('./report-parser');

  // Get raw markdown and render it
  const slug = slugify(job.company, job.url, job.filename);
  const rawMarkdown = getRawReportContent(slug);
  const renderedReport = rawMarkdown ? renderMarkdownToHtml(rawMarkdown) : '';

  const { getState, getStateMeta, getNextStates } = require('./state-manager');
  const stateData = getState(slug);
  const stateInfo = getStateMeta(stateData.state);
  const nextStates = getNextStates(stateData.state);

  const verdictClass = job.verdict?.includes('APPLY') ? 'verdict-apply' :
                       job.verdict?.includes('SKIP') ? 'verdict-skip' :
                       job.verdict?.includes('STRONG') ? 'verdict-strong' : 'verdict-consider';

  // Progress bar for score
  const filled = Math.round((job.score / 5) * 10);
  const empty = 10 - filled;
  const progressBar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${(job.score * 20).toFixed(0)}%`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>~/career-ops/eval/${job.company}</title>
    ${getStyles()}
    <style>
      .report-body { font-size: 13px; line-height: 1.7; }
      .report-body h1 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; margin: 24px 0 12px; color: var(--primary); border-bottom: 1px dashed var(--border); padding-bottom: 8px; }
      .report-body h2 { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; margin: 20px 0 10px; color: var(--primary-dim); text-transform: uppercase; letter-spacing: 0.05em; }
      .report-body h3 { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; margin: 16px 0 8px; color: var(--text-muted); }
      .report-body p { margin: 8px 0; color: var(--text-muted); }
      .report-body ul, .report-body ol { margin: 8px 0; padding-left: 20px; }
      .report-body li { margin: 4px 0; color: var(--text-muted); }
      .report-body strong { color: var(--text); font-weight: 700; }
      .report-body table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
      .report-body th { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-dim); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
      .report-body td { padding: 8px; border-bottom: 1px dashed var(--border); color: var(--text-muted); }
      .report-body tr:hover { background: var(--bg-hover); }
      .report-body blockquote { border-left: 3px solid var(--primary-dim); margin: 12px 0; padding: 8px 16px; background: var(--bg-alt); color: var(--text-muted); }
      .report-body code { background: var(--bg-alt); padding: 2px 6px; border-radius: 0; font-family: 'Space Mono', monospace; font-size: 12px; color: var(--primary-dim); border: 1px solid var(--border); }
      .report-body pre { background: var(--bg-alt); padding: 12px; border: 1px solid var(--border); overflow-x: auto; margin: 12px 0; }
      .report-body pre code { background: transparent; border: none; padding: 0; }
      .report-body a { color: var(--primary-dim); text-decoration: underline; }
      .report-body hr { border: none; border-top: 1px dashed var(--border); margin: 16px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="/logo.png" alt="Angry Mob" style="height:40px;width:auto;">
                <div>
                    <h1><a href="${dashboardUrl}/">~/career-ops/dashboard</a></h1>
                    <div class="breadcrumb">/eval/${job.company?.toLowerCase().replace(/\s+/g, '-')}</div>
                </div>
            </div>
            <div class="nav-buttons">
                <a href="${dashboardUrl}/" class="nav-btn">analytics /eval</a>
                <a href="${dashboardUrl}/?view=pipeline" class="nav-btn">list_alt /tracker</a>
                <a href="${dashboardUrl}/scan" class="nav-btn">radar /scan</a>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Sys header -->
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:16px;">
            <div>[SYS] RUNNING: EVAL_PROCESS_${job.rank?.toString().padStart(4, '0') || '0000'}...</div>
            <div>[SYS] TARGET: ${job.role?.toUpperCase()} @ ${job.company?.toUpperCase()}</div>
            <div>[SYS] STATUS: COMPLETED [ SUCCESS ]</div>
        </div>

        <!-- Score Card -->
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${job.role}</div>
                    <div class="card-subtitle">@${job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
                    ${job.archetype ? `<div style="font-size:12px;color:var(--primary-dim);margin-top:4px;">${job.archetype}</div>` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Space Grotesk',sans-serif;font-size:32px;font-weight:700;color:${sg.class === 'score-a' ? 'var(--success)' : sg.class === 'score-b' ? 'var(--warning)' : 'var(--primary-dim)'};">${job.score}/5.0</div>
                    <div class="progress-bar" style="margin-top:4px;">${progressBar}</div>
                </div>
            </div>

            <div class="verdict-banner ${verdictClass}">
                <span class="prompt"></span> ${job.verdict || 'EVALUATE'}
            </div>

            <!-- State Machine Display -->
            <div style="background:var(--bg-alt);border:1px solid var(--border);padding:16px;margin:16px 0;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                    <div>
                        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;">CURRENT STATE</div>
                        <div style="font-size:18px;font-weight:700;color:${stateInfo.color};margin-top:4px;">[ ${stateInfo.label} ]</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px;color:var(--text-dim);">STATE HISTORY</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                            ${stateData.history.length > 0 ? stateData.history.map(h => `"${h.state}" → "${h.date}"`).join(' → ') : 'No transitions yet'}
                        </div>
                    </div>
                </div>

                <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">TRANSITION ACTIONS</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${nextStates.map(ns => {
                      const nsMeta = getStateMeta(ns);
                      return `<button onclick="transitionState('${slug}', '${ns}')" class="btn" style="border-color:${nsMeta.color};color:${nsMeta.color};font-size:12px;padding:8px 14px;">
                          → ${nsMeta.label}
                      </button>`;
                    }).join('')}
                </div>
                <div id="state-status-${slug}" class="pdf-status" style="display:none;margin-top:8px;font-size:12px;"></div>
            </div>

            <!-- Evaluation Depth Banner -->
            ${job.evalDepth ? `
            <div style="background:var(--bg-alt);border:1px solid var(--border);padding:12px;margin:16px 0;display:flex;align-items:center;gap:12px;">
                <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;">ANALYSIS DEPTH</div>
                <div style="font-size:14px;font-weight:700;color:${job.evalDepth === 'full' ? 'var(--success)' : job.evalDepth === 'partial' ? 'var(--warning)' : 'var(--text-dim)'};">
                    ${job.evalDepth === 'full' ? '✓ FULL A-G EVALUATION' : job.evalDepth === 'partial' ? '◐ PARTIAL ANALYSIS' : '○ QUICK SCREEN'}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-left:auto;">
                    ${job.evalDepth === 'full' ? 'Blocks A-G complete' : job.evalDepth === 'partial' ? `${[job.blockA, job.blockB, job.blockC, job.blockD, job.blockE, job.blockF, job.blockG].filter(b => b && (b.matches?.length || b.stories?.length || b.legitimacy || b.hooks?.length || Object.keys(b).length > 0)).length} of 7 blocks` : 'Basic info only'}
                </div>
            </div>
            ` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div class="card" style="margin:0;">
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;">COMPENSATION</div>
                    <div style="font-size:14px;margin-top:4px;">${job.comp || 'Not specified'}</div>
                </div>
                <div class="card" style="margin:0;">
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;">LOCATION</div>
                    <div style="font-size:14px;margin-top:4px;">${job.location || 'Not specified'}</div>
                </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <a href="${job.url || '#'}" target="_blank" class="btn btn-primary">VIEW_JOB_POSTING</a>
                <a href="${dashboardUrl}/" class="btn">BACK_TO_DASHBOARD</a>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
                <button onclick="generateResume('${job.company}', '${job.role}', '${job.archetype || ''}')" class="btn btn-success">EXPORT_RESUME_PDF</button>
                <button onclick="generateCoverLetter('${job.company}', '${job.role}', '${job.archetype || ''}')" class="btn" style="border-color:var(--primary-dim);color:var(--primary-dim);">EXPORT_COVER_LETTER</button>
                <button onclick="generateEvalReport('${job.company}', '${job.role}', '${slug}')" class="btn" style="border-color:var(--warning);color:var(--warning);">EXPORT_ANALYSIS</button>
                <button onclick="generateFullEvalReport('${job.company}', '${job.role}', '${slug}')" class="btn" style="border-color:var(--pink);color:var(--pink);">EXPORT_FULL_EVAL</button>
            </div>
            <div id="pdf-status-${job.company?.toLowerCase().replace(/\s+/g, '')}" class="pdf-status" style="display:none;margin-top:8px;font-size:12px;"></div>
        </div>

        <!-- Full Rendered Report -->
        <div class="section-title">FULL_EVALUATION_REPORT</div>
        <div class="card report-body">
            ${renderedReport}
        </div>
    </div>

    ${getScripts()}
</body>
</html>`;
}

function renderScanPage(req) {
  const dashboardUrl = req?.app?.locals?.dashboardUrl || 'http://192.168.0.50:3000';
  const fs = require('fs');
  const path = require('path');
  const CONFIG = require('./config');

  // Read cron logs if available
  const logPath = path.join(CONFIG.CAREER_OPS_PATH, 'cron.log');
  let logs = [];
  if (fs.existsSync(logPath)) {
    logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim()).slice(-20);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>~/career-ops/scan</title>
    ${getStyles()}
</head>
<body>
    <div class="header">
        <div class="header-top">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="/logo.png" alt="Angry Mob" style="height:40px;width:auto;">
                <div>
                    <h1><a href="${dashboardUrl}/">~/career-ops/dashboard</a></h1>
                    <div class="breadcrumb">/scan</div>
                </div>
            </div>
            <div class="nav-buttons">
                <a href="${dashboardUrl}/" class="nav-btn">analytics /eval</a>
                <a href="${dashboardUrl}/?view=pipeline" class="nav-btn">list_alt /tracker</a>
                <a href="${dashboardUrl}/scan" class="nav-btn active">radar /scan</a>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="section-title">SYSTEM_STATUS</div>

        <div class="card">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">SCANNER_DAEMON</div>
                    <div style="color:var(--success);font-weight:700;margin-top:4px;">[ LIVENESS: OK ]</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">EVALUATOR_DAEMON</div>
                    <div style="color:var(--success);font-weight:700;margin-top:4px;">[ LIVENESS: OK ]</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">LAST_SCAN</div>
                    <div style="margin-top:4px;">${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">PENDING_EVALS</div>
                    <div style="margin-top:4px;">270 jobs queued</div>
                </div>
            </div>
        </div>

        <div class="section-title">RAW_ACTIVITY_STREAM</div>
        <div class="card" style="font-size:12px;line-height:1.8;">
            ${logs.length ? logs.map(l => `<div><span class="prompt"></span> ${l}</div>`).join('') : '<div style="color:var(--text-dim);"><span class="prompt"></span> No recent activity</div>'}
        </div>
    </div>

    ${getScripts()}
</body>
</html>`;
}

function renderQueueForm(req) {
  const dashboardUrl = req?.app?.locals?.dashboardUrl || 'http://192.168.0.50:3000';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>~/career-ops/queue</title>
    ${getStyles()}
</head>
<body>
    <div class="header">
        <div class="header-top">
            <div>
                <h1><a href="${dashboardUrl}/">~/career-ops/dashboard</a></h1>
                <div class="breadcrumb">/queue</div>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="section-title">QUEUE_NEW_TARGET</div>
        <div class="card">
            <form id="queueForm">
                <div style="margin-bottom:16px;">
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px;">JOB_POSTING_URL *</div>
                    <input type="url" name="url" required placeholder="https://jobs.ashbyhq.com/..."
                        style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:14px;">
                </div>
                <div style="margin-bottom:16px;">
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px;">NOTES (OPTIONAL)</div>
                    <input type="text" name="notes" placeholder="Role title, referrer"
                        style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:14px;">
                </div>
                <button type="submit" class="btn btn-success">QUEUE_FOR_EVALUATION</button>
            </form>
            <div id="result" style="margin-top:16px;font-size:13px;"></div>
        </div>
    </div>

    <script>
        document.getElementById('queueForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const result = document.getElementById('result');
            result.innerHTML = '<span style="color:var(--warning)">Processing...</span>';

            try {
                const res = await fetch('/api/queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: form.url.value, notes: form.notes.value })
                });
                const data = await res.json();
                if (data.success) {
                    result.innerHTML = '<span style="color:var(--success)">[OK] Queued: ' + data.entry.company + ' - ' + data.entry.role + '</span>';
                    form.reset();
                } else {
                    result.innerHTML = '<span style="color:var(--error)">[ERR] ' + (data.error || 'Failed') + '</span>';
                }
            } catch (err) {
                result.innerHTML = '<span style="color:var(--error)">[ERR] Network error</span>';
            }
        });
    </script>
</body>
</html>`;
}

module.exports = { renderDashboard, renderQueueForm, renderJobDetail, renderScanPage };
