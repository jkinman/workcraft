function emptyPipeline() {
  return { pending: [], inProgress: [], applied: [], rejected: [], total: 0 };
}

function parsePipelineContent(content) {
  const jobs = emptyPipeline();
  let currentSection = null;

  for (const line of (content || '').split('\n')) {
    if (/^#+\s+Pending/i.test(line)) {
      currentSection = 'pending';
      continue;
    }
    if (/^#+\s+In Progress/i.test(line)) {
      currentSection = 'inProgress';
      continue;
    }
    if (/^#+\s+Applied/i.test(line)) {
      currentSection = 'applied';
      continue;
    }
    if (/^#+\s+Rejected/i.test(line)) {
      currentSection = 'rejected';
      continue;
    }

    const match = line.match(/^- \[([ x])\] (https?:\/\/[^\s]+) \| ([^|]+) \| (.+)$/);
    if (!match || !currentSection) continue;

    const [, checked, url, company, role] = match;
    jobs[currentSection].push({
      url,
      company: company.trim(),
      role: role.trim(),
      status: checked === 'x' ? 'done' : 'pending'
    });
    jobs.total++;
  }

  return jobs;
}

function inferPipelineEntry(url, notes = '') {
  let company = 'Unknown';
  let role = 'Unknown';

  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  if (hostname.includes('ashbyhq.com')) {
    const match = url.match(/ashbyhq\.com\/([^/]+)/);
    if (match) company = titleCase(match[1]);
  } else if (hostname.includes('greenhouse.io')) {
    const match = url.match(/greenhouse\.io\/([^/]+)/);
    if (match) company = titleCase(match[1]);
  } else if (hostname.includes('lever.co')) {
    const match = url.match(/lever\.co\/([^/]+)/);
    if (match) company = titleCase(match[1]);
  } else {
    company = titleCase(hostname.replace(/^www\./, '').split('.')[0]);
  }

  if (notes && notes.includes('-')) {
    role = notes.split('-')[0].trim();
  } else if (notes) {
    role = notes.trim();
  }

  return { url, company, role, notes };
}

function addEntryToPipelineContent(content, entry) {
  let nextContent = content || '';
  const line = `- [ ] ${entry.url} | ${entry.company} | ${entry.role}${entry.notes ? ' - ' + entry.notes : ''}`;

  if (!nextContent.includes('## Pending')) {
    nextContent += '\n## Pending\n\n';
  }

  const pendingIndex = nextContent.indexOf('## Pending');
  const sectionEnd = nextContent.indexOf('##', pendingIndex + 1);

  if (sectionEnd !== -1) {
    return nextContent.slice(0, sectionEnd) + line + '\n' + nextContent.slice(sectionEnd);
  }

  return nextContent.replace(/\s*$/, '\n') + line + '\n';
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createPipelineService(dataClient) {
  return {
    list() {
      const content = dataClient.readPipeline();
      if (!content) return emptyPipeline();
      return parsePipelineContent(content);
    },

    async add(url, notes) {
      const entry = inferPipelineEntry(url, notes);
      const current = dataClient.readPipeline() || '';
      await dataClient.writePipeline(addEntryToPipelineContent(current, entry));
      return entry;
    }
  };
}

module.exports = {
  addEntryToPipelineContent,
  createPipelineService,
  emptyPipeline,
  inferPipelineEntry,
  parsePipelineContent
};
