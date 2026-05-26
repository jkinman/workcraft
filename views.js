// views.js - Main view orchestrator (terminal theme)
const { getEvaluations } = require('./evaluations');
const { getStyles } = require('./styles');
const { getScripts } = require('./scripts');
const { renderHeader, renderTopPicks, renderDetails, renderPipelineView, renderEvalTable, scoreToGrade } = require('./components');
const CONFIG = require('./config');

function renderDashboard(view, jobs, req) {
  const evals = getEvaluations();
  const dashboardUrl = req?.app?.locals?.dashboardUrl || CONFIG.DASHBOARD_URL;

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
  const dashboardUrl = req?.app?.locals?.dashboardUrl || CONFIG.DASHBOARD_URL;
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
            <div style="background:var(--bg-alt);border:1px solid var(--border);padding:12px;margin:16px 0;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;">ANALYSIS DEPTH</div>
                    <div style="font-size:14px;font-weight:700;color:${job.evalDepth === 'full' ? 'var(--success)' : job.evalDepth === 'partial' ? 'var(--warning)' : 'var(--text-dim)'};">
                        ${job.evalDepth === 'full' ? '●●● FULL A-G' : job.evalDepth === 'partial' ? '●●○ PARTIAL' : '●○○ SCREEN'}
                    </div>
                </div>
                ${job.evalDepth !== 'full' ? `
                <div style="display:flex;gap:8px;align-items:center;padding-top:12px;border-top:1px dashed var(--border);">
                    <span style="font-size:12px;color:var(--text-muted);">This job needs full A-G analysis before applying.</span>
                    <button onclick="queueForFullEval('${job.company}', '${job.role}', '${job.url || ''}')" class="btn btn-success" style="font-size:11px;padding:6px 12px;">QUEUE FULL A-G ANALYSIS</button>
                </div>
                ` : ''}
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

const { getScanStats } = require('./scan-data');

function renderScanPage(req) {
  const dashboardUrl = req?.app?.locals?.dashboardUrl || CONFIG.DASHBOARD_URL;
  const stats = getScanStats();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>~/career-ops/scan</title>
    ${getStyles()}
    <style>
      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .stat-card { background: var(--bg-alt); border: 1px solid var(--border); padding: 16px; }
      .stat-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
      .stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: var(--primary); }
      .stat-sub { font-size: 11px; color: var(--text-dim); margin-top: 4px; }
      .activity-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 12px; }
      .activity-row:last-child { border-bottom: none; }
      .portal-badge { font-size: 10px; padding: 2px 6px; border-radius: 0; text-transform: uppercase; letter-spacing: 0.05em; }
      .portal-greenhouse { background: rgba(25, 81, 31, 0.3); color: var(--success); border: 1px solid var(--success); }
      .portal-ashby { background: rgba(65, 75, 131, 0.3); color: var(--primary-dim); border: 1px solid var(--primary-dim); }
      .portal-lever { background: rgba(133, 50, 78, 0.3); color: var(--pink); border: 1px solid var(--pink); }
      .portal-pinpoint { background: rgba(249, 226, 175, 0.15); color: var(--warning); border: 1px solid var(--warning); }
      .portal-ycombinator { background: rgba(255, 180, 171, 0.15); color: var(--error); border: 1px solid var(--error); }
      .portal-linkedin { background: rgba(0, 119, 181, 0.2); color: #0077b5; border: 1px solid #0077b5; }
      .portal-indeed { background: rgba(255, 102, 0, 0.2); color: #ff6600; border: 1px solid #ff6600; }
      .score-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; }
      .scan-btn { background: var(--success-bg); color: var(--success); border: 1px solid var(--success); padding: 12px 24px; font-family: 'Space Mono', monospace; font-size: 14px; cursor: pointer; transition: all 0.2s; }
      .scan-btn:hover { background: var(--success); color: var(--bg); }
      .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .scan-btn-secondary { background: var(--bg-alt); color: var(--primary-dim); border: 1px solid var(--primary-dim); padding: 12px 24px; font-family: 'Space Mono', monospace; font-size: 14px; cursor: pointer; transition: all 0.2s; }
      .scan-btn-secondary:hover { background: var(--primary-dim); color: var(--bg); }
      .scan-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
      .scan-status { margin-top: 12px; font-size: 12px; padding: 12px; background: var(--bg); border: 1px solid var(--border); display: none; }
      .scan-status.active { display: block; }
      .progress-bar-scan { height: 4px; background: var(--bg); border: 1px solid var(--border); margin-top: 8px; }
      .progress-bar-scan-fill { height: 100%; background: var(--success); width: 0%; transition: width 0.3s; }
    </style>
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
        <!-- Scan Controls -->
        <div class="section-title">SCAN_CONTROLS</div>
        <div class="card">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <button id="scanBtn" onclick="runScan()" class="scan-btn">
                    <span style="margin-right:8px;">▶</span> RUN_FULL_SCAN
                </button>
                <button id="dryRunBtn" onclick="runDryRun()" class="btn" style="border-color:var(--primary-dim);color:var(--primary-dim);">
                    DRY_RUN
                </button>
                <button id="deepDiveBtn" onclick="runDeepDive()" class="scan-btn-secondary">
                    <span style="margin-right:8px;">🔍</span> DEEP_DIVE (LinkedIn)
                </button>
                <div style="font-size:12px;color:var(--text-dim);margin-left:auto;">
                    ${stats.companiesEnabled} companies + browser scrapers
                </div>
            </div>
            <div id="scanStatus" class="scan-status">
                <div id="scanStatusText"><span class="prompt"></span> Initializing scan...</div>
                <div class="progress-bar-scan"><div id="scanProgress" class="progress-bar-scan-fill"></div></div>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="section-title">SYSTEM_METRICS</div>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Total Jobs Scanned</div>
                <div class="stat-value">${stats.totalScanned.toLocaleString()}</div>
                <div class="stat-sub">Since 2026-04-15</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pending Evaluation</div>
                <div class="stat-value" style="color:var(--warning)">${stats.pendingJobs}</div>
                <div class="stat-sub">In pipeline</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Evaluations Done</div>
                <div class="stat-value" style="color:var(--success)">${stats.totalEvaluated}</div>
                <div class="stat-sub">Reports generated</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Scan</div>
                <div class="stat-value" style="font-size:18px;margin-top:8px;">${stats.lastScanDate || 'Never'}</div>
                <div class="stat-sub">${stats.recentScans.length} jobs found today</div>
            </div>
        </div>

        <!-- Portal Breakdown -->
        <div class="section-title">PORTAL_BREAKDOWN</div>
        <div class="card">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;">
                ${Object.entries(stats.portalBreakdown).sort((a,b) => b[1] - a[1]).map(([portal, count]) => {
                  const portalClass = portal.replace('-api', '').toLowerCase();
                  return `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border:1px solid var(--border);">
                        <span class="portal-badge portal-${portalClass}">${portal.replace('-api', '').toUpperCase()}</span>
                        <span style="font-size:18px;font-weight:700;">${count}</span>
                    </div>
                  `;
                }).join('')}
            </div>
        </div>

        <!-- Today's Scans -->
        <div class="section-title">TODAY'S_DISCOVERIES (${stats.recentScans.length})</div>
        <div class="card">
            ${stats.recentScans.length ? stats.recentScans.map(s => {
              const portalClass = s.portal.replace('-api', '').toLowerCase();
              return `
                <div class="activity-row">
                    <span class="portal-badge portal-${portalClass}">${s.portal.replace('-api', '').toUpperCase()}</span>
                    <span style="font-weight:600;min-width:120px;">${s.company}</span>
                    <span style="color:var(--text-muted);flex:1;">${s.title}</span>
                    <a href="${s.url}" target="_blank" style="color:var(--primary-dim);font-size:11px;">VIEW →</a>
                </div>
              `;
            }).join('') : '<div style="color:var(--text-dim);padding:12px;"><span class="prompt"></span> No new discoveries today</div>'}
        </div>

        <!-- Pending Pipeline -->
        <div class="section-title">PENDING_PIPELINE (${stats.pendingJobs})</div>
        <div class="card">
            ${stats.pipelineJobs.length ? stats.pipelineJobs.map(j => `
                <div class="activity-row">
                    <span style="font-weight:600;min-width:120px;">${j.company}</span>
                    <span style="color:var(--text-muted);flex:1;">${j.role}</span>
                    <a href="${j.url}" target="_blank" style="color:var(--primary-dim);font-size:11px;">VIEW →</a>
                </div>
            `).join('') : '<div style="color:var(--text-dim);padding:12px;"><span class="prompt"></span> Pipeline empty</div>'}
        </div>

        <!-- Recent Evaluations -->
        <div class="section-title">RECENT_EVALUATIONS (${stats.recentEvaluations.length})</div>
        <div class="card">
            ${stats.recentEvaluations.map(e => {
              const scoreColor = e.score >= 4.5 ? 'var(--success)' : e.score >= 4.0 ? 'var(--warning)' : 'var(--text-dim)';
              const slug = e.filename.replace('.md', '');
              return `
                <div class="activity-row" style="cursor:pointer;" onclick="window.location='/job/${slug}'">
                    <span style="font-weight:600;min-width:120px;">${e.company}</span>
                    <span style="color:var(--text-muted);flex:1;">${e.role}</span>
                    ${e.score ? `<span class="score-badge" style="background:${scoreColor}20;color:${scoreColor};border:1px solid ${scoreColor};">${e.score}/5</span>` : ''}
                    <span style="color:var(--text-dim);font-size:11px;">${e.date || ''}</span>
                </div>
              `;
            }).join('')}
        </div>
    </div>

    ${getScripts()}
    <script>
        async function runScan() {
            const btn = document.getElementById('scanBtn');
            const status = document.getElementById('scanStatus');
            const statusText = document.getElementById('scanStatusText');
            const progress = document.getElementById('scanProgress');
            const dryBtn = document.getElementById('dryRunBtn');

            btn.disabled = true;
            dryBtn.disabled = true;
            status.classList.add('active');
            statusText.innerHTML = '<span class="prompt"></span> Starting scan...';
            progress.style.width = '10%';

            try {
                const res = await fetch('/api/scan', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    progress.style.width = '100%';
                    statusText.innerHTML = '<span style="color:var(--success)"><span class="prompt"></span> Scan complete!</span>';
                    statusText.innerHTML += '<br><span style="color:var(--text-muted)">Companies: ' + data.companies + ' | Found: ' + data.totalFound + ' | New: ' + data.newOffers + '</span>';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    progress.style.width = '0%';
                    statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + (data.error || 'Scan failed') + '</span>';
                    btn.disabled = false;
                    dryBtn.disabled = false;
                }
            } catch (err) {
                progress.style.width = '0%';
                statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + err.message + '</span>';
                btn.disabled = false;
                dryBtn.disabled = false;
            }
        }

        async function runDryRun() {
            const btn = document.getElementById('dryRunBtn');
            const status = document.getElementById('scanStatus');
            const statusText = document.getElementById('scanStatusText');
            const progress = document.getElementById('scanProgress');
            const scanBtn = document.getElementById('scanBtn');

            btn.disabled = true;
            scanBtn.disabled = true;
            status.classList.add('active');
            statusText.innerHTML = '<span class="prompt"></span> Running dry scan...';
            progress.style.width = '10%';

            try {
                const res = await fetch('/api/scan?dryRun=true', { method: 'POST' });
                const data = await res.json();

                progress.style.width = '100%';
                if (data.success) {
                    statusText.innerHTML = '<span style="color:var(--warning)"><span class="prompt"></span> Dry run complete (no changes saved)</span>';
                    statusText.innerHTML += '<br><span style="color:var(--text-muted)">Companies: ' + data.companies + ' | Found: ' + data.totalFound + ' | New: ' + data.newOffers + '</span>';
                } else {
                    statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + (data.error || 'Scan failed') + '</span>';
                }
                btn.disabled = false;
                scanBtn.disabled = false;
            } catch (err) {
                progress.style.width = '0%';
                statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + err.message + '</span>';
                btn.disabled = false;
                scanBtn.disabled = false;
            }
        }

        async function runDeepDive() {
            const btn = document.getElementById('deepDiveBtn');
            const status = document.getElementById('scanStatus');
            const statusText = document.getElementById('scanStatusText');
            const progress = document.getElementById('scanProgress');
            const scanBtn = document.getElementById('scanBtn');
            const dryBtn = document.getElementById('dryRunBtn');

            btn.disabled = true;
            scanBtn.disabled = true;
            dryBtn.disabled = true;
            status.classList.add('active');
            statusText.innerHTML = '<span class="prompt"></span> Running deep-dive scan (LinkedIn browser scrape)...';
            progress.style.width = '10%';

            try {
                const res = await fetch('/api/scan?deepDive=true', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    progress.style.width = '100%';
                    statusText.innerHTML = '<span style="color:var(--success)"><span class="prompt"></span> Deep-dive complete!</span>';
                    statusText.innerHTML += '<br><span style="color:var(--text-muted)">Tasks: ' + (data.tasks || 1) + ' | Found: ' + data.totalFound + ' | New: ' + data.newOffers + '</span>';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    progress.style.width = '0%';
                    statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + (data.error || 'Deep-dive failed') + '</span>';
                    btn.disabled = false;
                    scanBtn.disabled = false;
                    dryBtn.disabled = false;
                }
            } catch (err) {
                progress.style.width = '0%';
                statusText.innerHTML = '<span style="color:var(--error)"><span class="prompt"></span> Error: ' + err.message + '</span>';
                btn.disabled = false;
                scanBtn.disabled = false;
                dryBtn.disabled = false;
            }
        }
    </script>
</body>
</html>`;
}

function renderQueueForm(req) {
  const dashboardUrl = req?.app?.locals?.dashboardUrl || CONFIG.DASHBOARD_URL;

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
