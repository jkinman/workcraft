// scripts.js - All JavaScript functions for the dashboard
function getScripts() {
  return `
    <script>
        function toggleDetails(id) {
            const el = document.getElementById(id);
            el.classList.toggle('show');
        }
        
        async function generatePDF(company, role, archetype) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('pdf-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, jobDescription: archetype })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = 'PDF generated! <a href="' + data.downloadUrl + '" style="color: #fff; text-decoration: underline;">Download</a> (' + data.keywords + ' keywords, ' + data.format + ', ' + (data.experienceCount || '4') + ' roles)';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = 'Error: ' + (data.error || 'Failed to generate PDF');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = 'Network error. Please try again.';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry';
            }
            
            btn.disabled = false;
        }
        
        async function generateCoverLetter(company, role, archetype) {
            const key = company.toLowerCase().replace(/\\s+/g, '');
            const statusDiv = document.getElementById('cover-status-' + key);
            const btn = event.target;
            
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.className = 'pdf-status';
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/generate-cover-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company, role, jobDescription: archetype, archetype })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.className = 'pdf-status success';
                    statusDiv.innerHTML = 'Cover letter generated! <a href="' + data.downloadUrl + '" style="color: #fff; text-decoration: underline;">Download PDF</a>';
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Regenerate';
                } else {
                    statusDiv.className = 'pdf-status error';
                    statusDiv.textContent = 'Error: ' + (data.error || 'Failed to generate cover letter');
                    statusDiv.style.display = 'block';
                    btn.textContent = 'Retry';
                }
            } catch (error) {
                statusDiv.className = 'pdf-status error';
                statusDiv.textContent = 'Network error. Please try again.';
                statusDiv.style.display = 'block';
                btn.textContent = 'Retry';
            }
            
            btn.disabled = false;
        }
        
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
