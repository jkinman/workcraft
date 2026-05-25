// scripts.js - All JavaScript functions for the dashboard
function getScripts() {
  return `
    <script>
        function toggleDetails(id) {
            const el = document.getElementById(id);
            el.classList.toggle('show');
        }
        
        // ─── PDF GENERATION ─────────────────────────────────────────────────
        
        async function generateResume(company, role, archetype) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('pdf-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, jobDescription: archetype })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = '[RESUME] Generated! <a href="' + data.downloadUrl + '" style="color: var(--success); text-decoration: underline;">Download</a>';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate Resume';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = '[ERR] ' + (data.error || 'Failed');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry Resume';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = '[ERR] Network error';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry Resume';
            }
            
            btn.disabled = false;
        }
        
        async function generateCoverLetter(company, role, archetype) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('pdf-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-cover-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, jobDescription: archetype })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = '[COVER LETTER] Generated! <a href="' + data.downloadUrl + '" style="color: var(--success); text-decoration: underline;">Download</a>';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate Cover Letter';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = '[ERR] ' + (data.error || 'Failed');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry Cover Letter';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = '[ERR] Network error';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry Cover Letter';
            }
            
            btn.disabled = false;
        }
        
        async function generateEvalReport(company, role, slug) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('pdf-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-eval-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, slug })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = '[ANALYSIS] Generated! <a href="' + data.downloadUrl + '" style="color: var(--success); text-decoration: underline;">Download</a>';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate Analysis';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = '[ERR] ' + (data.error || 'Failed');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry Analysis';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = '[ERR] Network error';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry Analysis';
            }
            
            btn.disabled = false;
        }
        
        async function generateFullEvalReport(company, role, slug) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('pdf-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-full-eval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, slug })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = '[FULL EVAL] Generated! <a href="' + data.downloadUrl + '" style="color: var(--success); text-decoration: underline;">Download</a>';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate Full Eval';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = '[ERR] ' + (data.error || 'Failed');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry Full Eval';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = '[ERR] Network error';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry Full Eval';
            }
            
            btn.disabled = false;
        }
        
        // Legacy support
        async function generatePDF(company, role, archetype) {
            return generateResume(company, role, archetype);
        }
        
        // ─── STATE TRANSITIONS ──────────────────────────────────────────────
        
        async function transitionState(slug, newState) {
            const statusDiv = document.getElementById('state-status-' + slug);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Updating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/transition-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, newState })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.textContent = '[OK] State updated: ' + data.previous + ' → ' + data.state;
                    statusDiv.style.display = 'block';
                    // Reload page after short delay to show new state
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = '[ERR] ' + (data.error || 'Failed');
                    statusDiv.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'Retry';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = '[ERR] Network error';
                statusDiv.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Retry';
            }
        }
        
        // ─── QUEUE ──────────────────────────────────────────────────────────
        
        async function queueForEval(url, company, role) {
            if (!confirm('Queue ' + company + ' - ' + role + ' for A-G evaluation?')) return;
            
            try {
                const response = await fetch('/api/queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, notes: role })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Queued for evaluation! Tell Squidworth to evaluate it.');
                } else {
                    alert('Error: ' + (data.error || 'Failed to queue'));
                }
            } catch (error) {
                alert('Network error. Please try again.');
            }
        }
    </script>
  `;
}

module.exports = { getScripts };
