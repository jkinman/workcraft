// server.js - Main entry point
const express = require('express');
const CONFIG = require('./config');
const { parsePipeline, addToPipeline } = require('./pipeline');
const { renderDashboard, renderQueueForm } = require('./views');
const { generateTailoredCV } = require('./pdf-generator');
const { generateCoverLetter } = require('./cover-letter-generator');

const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  const view = req.query.view || 'ranked';
  const jobs = parsePipeline();
  res.send(renderDashboard(view, jobs));
});

app.get('/queue', (req, res) => {
  res.send(renderQueueForm());
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

// Cover Letter Generation endpoint
app.post('/api/generate-cover-letter', async (req, res) => {
  const { company, role, jobDescription, archetype } = req.body;
  
  if (!company || !role) {
    return res.status(400).json({ error: 'Company and role are required' });
  }
  
  try {
    const result = await generateCoverLetter(company, role, jobDescription || '', archetype || '');
    
    if (result.success) {
      res.json({
        success: true,
        message: `Cover letter generated for ${company}`,
        text: result.text,
        textFilename: result.textFilename,
        pdfFilename: result.pdfFilename,
        downloadUrl: result.downloadUrl,
        company: result.company,
        role: result.role
      });
    } else {
      res.status(500).json({ error: result.error || 'Cover letter generation failed' });
    }
  } catch (error) {
    console.error('Cover Letter Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PDF Generation endpoint
app.post('/api/generate-pdf', async (req, res) => {
  const { company, role, jobDescription } = req.body;
  
  if (!company || !role) {
    return res.status(400).json({ error: 'Company and role are required' });
  }
  
  try {
    const result = await generateTailoredCV(company, role, jobDescription || '');
    
    if (result.success) {
      res.json({
        success: true,
        message: `PDF generated: ${result.filename}`,
        filename: result.filename,
        path: result.path,
        keywords: result.keywords,
        format: result.format,
        downloadUrl: `/download-pdf?file=${encodeURIComponent(result.filename)}`
      });
    } else {
      res.status(500).json({ error: result.error || 'PDF generation failed' });
    }
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: error.message });
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
  
  // Security: only allow filenames with expected pattern
  if (!filename.match(/^cv-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/)) {
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`Career-Ops Web Dashboard running on http://0.0.0.0:${CONFIG.PORT}`);
  console.log(`Local network: http://192.168.0.50:${CONFIG.PORT}`);
  console.log(`Tailscale VPN: http://100.100.130.37:${CONFIG.PORT}`);
  console.log(`PDF Generation: POST /api/generate-pdf`);
  console.log(`PDF Download: GET /download-pdf?file=...`);
});
