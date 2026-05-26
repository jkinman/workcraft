// server.js - Main entry point
const express = require('express');
const CONFIG = require('./config');
const { parsePipeline, addToPipeline } = require('./pipeline');
const { renderDashboard, renderQueueForm, renderJobDetail, renderScanPage } = require('./views');
const { generateTailoredCV } = require('./pdf-generator');

const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make dashboard URL available to all views
app.locals.dashboardUrl = CONFIG.DASHBOARD_URL;

// Routes
app.get('/', (req, res) => {
  const view = req.query.view || 'ranked';
  const jobs = parsePipeline();
  res.send(renderDashboard(view, jobs, req));
});

app.get('/scan', (req, res) => {
  res.send(renderScanPage(req));
});

app.get('/job/:slug', (req, res) => {
  const { slug } = req.params;
  const { getReportBySlug } = require('./report-parser');
  const job = getReportBySlug(slug);

  if (!job) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>[404] Not Found</title></head>
      <body style="background:#121221;color:#e3e0f7;font-family:'Space Mono',monospace;padding:2rem;">
        <div style="font-size:24px;font-weight:700;color:#ffb4ab;">[ERR] JOB_NOT_FOUND</div>
        <div style="margin-top:12px;color:#90909a;">No evaluation found for slug: ${slug}</div>
        <a href="/" style="color:#bac3ff;display:inline-block;margin-top:16px;"><span style="color:#99d595;">></span> RETURN_TO_DASHBOARD</a>
      </body></html>
    `);
  }

  res.send(renderJobDetail(job, req));
});

app.get('/queue', (req, res) => {
  res.send(renderQueueForm(req));
});

app.post('/api/queue', (req, res) => {
  const { url, notes } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const entry = addToPipeline(url, notes);
    res.json({ 
      success: true, 
      message: 'Job queued for evaluation',
      entry
    });
  } catch (error) {
    console.error('Error writing to pipeline:', error);
    res.status(500).json({ error: 'Failed to queue job' });
  }
});

// Location-based job search endpoint
app.post('/api/search-location', async (req, res) => {
  const { location, role } = req.body;
  
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  
  // Store search in pipeline for tracking
  const searchEntry = {
    url: `search://${location}/${role || 'software-engineer'}`,
    company: `Search: ${location}`,
    role: role || 'Software Engineer',
    status: 'search',
    date: new Date().toISOString()
  };
  
  // Return search results structure
  res.json({
    success: true,
    location,
    role: role || 'Software Engineer',
    message: `Job search queued for ${location}. Use these sources:`,
    sources: [
      { name: 'LinkedIn Jobs', url: `https://ca.linkedin.com/jobs/${role?.replace(/\s+/g, '-') || 'software-engineer'}-jobs-${location.toLowerCase().replace(/\s+/g, '-')}` },
      { name: 'Indeed Canada', url: `https://ca.indeed.com/q-${role?.replace(/\s+/g, '-') || 'software-engineer'}-l-${location.toLowerCase().replace(/\s+/g, '-')}-jobs.html` },
      { name: 'Glassdoor', url: `https://www.glassdoor.ca/Job/${location.toLowerCase().replace(/\s+/g, '-')}-${role?.replace(/\s+/g, '-') || 'software-engineer'}-jobs-SRCH_IL.0,7_IC2275123_KO8,25.htm` }
    ]
  });
});

// PDF Generation endpoints
const { generateResumePDF, generateCoverLetterPDF, generateEvalReportPDF, generateFullEvalReportPDF } = require('./pdf-bundle-generator');

app.post('/api/generate-resume', async (req, res) => {
  const { company, role, jobDescription } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'Company and role required' });
  
  try {
    const result = await generateResumePDF(company, role, jobDescription || '');
    res.json(result);
  } catch (error) {
    console.error('Resume generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/generate-cover-letter', async (req, res) => {
  const { company, role, jobDescription } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'Company and role required' });
  
  try {
    const result = await generateCoverLetterPDF(company, role, jobDescription || '');
    res.json(result);
  } catch (error) {
    console.error('Cover letter generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/generate-eval-report', async (req, res) => {
  const { company, role } = req.body;
  if (!company) return res.status(400).json({ error: 'Company required' });
  
  try {
    const { getReportBySlug, getRawReportContent } = require('./report-parser');
    const slug = req.body.slug || company.toLowerCase().replace(/\s+/g, '-');
    const job = getReportBySlug(slug);
    if (!job) return res.status(404).json({ error: 'Job evaluation not found' });
    
    const rawMarkdown = getRawReportContent(slug);
    const result = await generateEvalReportPDF(job, rawMarkdown);
    res.json(result);
  } catch (error) {
    console.error('Eval report generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/generate-full-eval', async (req, res) => {
  const { company, role } = req.body;
  if (!company) return res.status(400).json({ error: 'Company required' });
  
  try {
    const { getReportBySlug, getRawReportContent } = require('./report-parser');
    const slug = req.body.slug || company.toLowerCase().replace(/\s+/g, '-');
    const job = getReportBySlug(slug);
    if (!job) return res.status(404).json({ error: 'Job evaluation not found' });
    
    const rawMarkdown = getRawReportContent(slug);
    const result = await generateFullEvalReportPDF(job, rawMarkdown);
    res.json(result);
  } catch (error) {
    console.error('Full eval report generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy PDF endpoint (redirects to resume)
app.post('/api/generate-pdf', async (req, res) => {
  const { company, role, jobDescription } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'Company and role required' });
  
  try {
    const result = await generateResumePDF(company, role, jobDescription || '');
    res.json(result);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF Download endpoint
app.get('/download-pdf', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const filename = req.query.file;
  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }
  
  // Security: allow expected filename patterns
  if (!filename.match(/^(cv|cover-letter|eval-report|full-eval)-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filePath = path.join(CONFIG.CAREER_OPS_PATH, 'output', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Scan endpoint
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

app.post('/api/scan', async (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  const deepDive = req.query.deepDive === 'true';
  
  try {
    const args = [];
    if (dryRun) args.push('--dry-run');
    if (deepDive) args.push('--deep-dive');
    
    const { stdout, stderr } = await execFilePromise('node', ['scan.mjs', ...args], {
      cwd: CONFIG.CAREER_OPS_PATH,
      timeout: deepDive ? 300_000 : 120_000, // 5 min for deep-dive (browser scraping)
      maxBuffer: 1024 * 1024 // 1MB output buffer
    });

    // Parse scan summary from output
    const companiesMatch = stdout.match(/Companies scanned:\s+(\d+)/);
    const foundMatch = stdout.match(/Total jobs found:\s+(\d+)/);
    const newMatch = stdout.match(/New offers added:\s+(\d+)/);
    const tasksMatch = stdout.match(/Tasks run:\s+(\d+)/);

    res.json({
      success: true,
      dryRun,
      deepDive,
      companies: parseInt(companiesMatch?.[1] || '0'),
      tasks: parseInt(tasksMatch?.[1] || '0'),
      totalFound: parseInt(foundMatch?.[1] || '0'),
      newOffers: parseInt(newMatch?.[1] || '0'),
      output: stdout.slice(-2000) // Last 2000 chars for debugging
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr?.slice(-500),
      stdout: error.stdout?.slice(-500)
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// State transition endpoint
app.post('/api/transition-state', (req, res) => {
  const { slug, newState } = req.body;
  if (!slug || !newState) {
    return res.status(400).json({ error: 'Slug and newState required' });
  }

  const { transitionState } = require('./state-manager');
  const result = transitionState(slug, newState);
  res.json(result);
});

app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`Career-Ops Web Dashboard running on http://0.0.0.0:${CONFIG.PORT}`);
  console.log(`Local network: http://192.168.0.50:${CONFIG.PORT}`);
  console.log(`Tailscale VPN: http://100.100.130.37:${CONFIG.PORT}`);
  console.log(`PDF Generation: POST /api/generate-pdf`);
  console.log(`PDF Download: GET /download-pdf?file=...`);
});
