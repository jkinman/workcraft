/**
 * Dashboard slug generation for evaluation reports.
 */

export function extractJobId(url) {
  if (!url || url === '#') return null;
  const ashby = url.match(/ashbyhq\.com\/[^/]+\/([a-f0-9-]{8,})/);
  if (ashby) return ashby[1].split('-')[0];
  const gh = url.match(/\/jobs\/(\d+)/);
  if (gh) return gh[1];
  const yc = url.match(/\/jobs\/([a-zA-Z0-9]{5,})/i);
  if (yc) return yc[1];
  return null;
}

export function slugify(company, url, filename) {
  const reportNumMatch = filename ? filename.match(/^(\d+)-/) : null;
  const reportNum = reportNumMatch ? reportNumMatch[1] : null;
  const companySlug = company?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';

  if (reportNum) {
    return `${companySlug}-${reportNum}`;
  }

  const jobId = extractJobId(url);
  return jobId ? `${companySlug}-${jobId}` : companySlug;
}
