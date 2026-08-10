import tenantServices from '../../lib/tenant-services';
import responses from '../../lib/api/responses';
import outputFiles from '../../lib/api/output-files';

const { getTenantServices } = tenantServices;
const { jsonError, jsonNotFound } = responses;
const { pdfDownloadHeaders, validatePdfFilename } = outputFiles;

export async function GET(request) {
  const url = new URL(request.url);
  const { services } = await getTenantServices(request);

  let filename;
  try {
    filename = validatePdfFilename(url.searchParams.get('file'));
  } catch (error) {
    return jsonError(error.message, 400);
  }

  const body = services.dataClient.readOutputFile(filename);
  if (!body) return jsonNotFound('File not found');

  return new Response(body, {
    headers: pdfDownloadHeaders(filename)
  });
}
