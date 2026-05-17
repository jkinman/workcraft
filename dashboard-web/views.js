// views.js - Main view orchestrator (refactored)
const { getEvaluations } = require('./evaluations');
const { getStyles } = require('./styles');
const { getScripts } = require('./scripts');
const { renderHeader, renderTopPicks, renderEvalCard, renderPipelineView } = require('./components');

function renderDashboard(view, jobs) {
  const evals = getEvaluations();
  
  // Calculate stats
  const dream = evals.filter(e => e.score >= 4.5).length;
  const strong = evals.filter(e => e.score >= 4.0 && e.score < 4.5).length;
  const good = evals.filter(e => e.score >= 3.5 && e.score < 4.0).length;
  const total = evals.length;
  
  const stats = { dream, strong, good, total, view };
  
  // Build content based on view
  let content = '';
  if (view === 'pipeline') {
    content = renderPipelineView(jobs);
  } else {
    content = renderTopPicks(evals);
    content += '<div class="section-title">Ranked Evaluations</div>';
    content += evals.map((e, i) => renderEvalCard(e, i)).join('');
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Career-Ops Dashboard</title>
    ${getStyles()}
</head>
<body>
    ${renderHeader(stats)}
    
    <div class="container">
        ${content}
    </div>
    
    ${getScripts()}
</body>
</html>
  `;
}

function renderQueueForm() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Queue New Job - Career-Ops</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            line-height: 1.6;
        }
        .nav {
            background: #161b22;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #30363d;
        }
        .nav a {
            color: #58a6ff;
            text-decoration: none;
            font-weight: 500;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
        }
        .header {
            margin-bottom: 2rem;
        }
        .header h1 {
            font-size: 1.5rem;
            color: #58a6ff;
            margin-bottom: 0.5rem;
        }
        .header p {
            color: #8b949e;
        }
        .form-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 1.5rem;
        }
        .form-group {
            margin-bottom: 1.25rem;
        }
        .form-label {
            display: block;
            font-size: 0.9rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
            color: #c9d1d9;
        }
        .form-input {
            width: 100%;
            padding: 0.75rem;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 6px;
            color: #c9d1d9;
            font-size: 1rem;
        }
        .form-input:focus {
            outline: none;
            border-color: #58a6ff;
        }
        .form-hint {
            font-size: 0.8rem;
            color: #8b949e;
            margin-top: 0.25rem;
        }
        .btn-submit {
            width: 100%;
            padding: 0.875rem;
            background: #238636;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
        }
        .btn-submit:hover {
            background: #2ea043;
        }
        .result {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 8px;
            display: none;
        }
        .result.success {
            background: #238636;
            color: #fff;
            display: block;
        }
        .result.error {
            background: #da3633;
            color: #fff;
            display: block;
        }
    </style>
</head>
<body>
    <div class="nav">
        <a href="/">← Back to Dashboard</a>
    </div>
    
    <div class="container">
        <div class="header">
            <h1>Queue New Evaluation</h1>
            <p>Paste a job posting URL to add it to the pipeline</p>
        </div>
        
        <div class="form-card">
            <form id="queueForm">
                <div class="form-group">
                    <label class="form-label">Job Posting URL *</label>
                    <input type="url" name="url" class="form-input" placeholder="https://jobs.ashbyhq.com/..." required>
                    <div class="form-hint">From Ashby, Greenhouse, Lever, etc.</div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" name="notes" class="form-input" placeholder="Role title, referrer">
                </div>
                

                <div class="form-group">
                    <label class="form-label">Location Search</label>
                    <input type="text" name="location" class="form-input" placeholder="e.g., Kelowna, Calgary, Toronto">
                    <div class="form-hint">Search for jobs in specific cities</div>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn-submit">Queue for Evaluation</button>
                    <button type="button" class="btn-submit" style="background: #1f6feb;" onclick="searchLocation()">Search Location</button>
                </div>
            </form>
            
            <div id="result" class="result"></div>
        </div>
    </div>
    
    <script>
        document.getElementById('queueForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const btn = form.querySelector('button');
            const result = document.getElementById('result');
            
            btn.disabled = true;
            btn.textContent = 'Queueing...';
            
            try {
                const res = await fetch('/api/queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: form.url.value, notes: form.notes.value })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    result.className = 'result success';
                    result.textContent = 'Queued: ' + data.entry.company + ' - ' + data.entry.role;
                    form.reset();
                } else {
                    result.className = 'result error';
                    result.textContent = 'Error: ' + (data.error || 'Failed');
                }
            } catch (err) {
                result.className = 'result error';
                result.textContent = 'Network error';
            }
            
            btn.disabled = false;
            btn.textContent = 'Queue for Evaluation';
        });
        
        async function searchLocation() {
            const location = document.querySelector('input[name="location"]').value;
            const notes = document.querySelector('input[name="notes"]').value;
            const result = document.getElementById('result');
            
            if (!location) {
                result.className = 'result error';
                result.textContent = 'Please enter a location';
                result.style.display = 'block';
                return;
            }
            
            result.className = 'result';
            result.textContent = 'Searching...';
            result.style.display = 'block';
            
            try {
                const res = await fetch('/api/search-location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location, role: notes || 'Software Engineer' })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    result.className = 'result success';
                    let html = '<strong>Job search for ' + data.location + '</strong><br><br>';
                    html += 'Search these sources:<br>';
                    data.sources.forEach(src => {
                        html += '• <a href="' + src.url + '" target="_blank" style="color: #fff;">' + src.name + '</a><br>';
                    });
                    result.innerHTML = html;
                } else {
                    result.className = 'result error';
                    result.textContent = 'Error: ' + (data.error || 'Failed');
                }
            } catch (err) {
                result.className = 'result error';
                result.textContent = 'Network error';
            }
        }
    </script>
</body>
</html>
  `;
}

module.exports = { renderDashboard, renderQueueForm };
