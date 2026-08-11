import tenantServices from '../../../lib/tenant-services';
import responses from '../../../lib/api/responses';
import { createLlmObservabilityService } from '../../../lib/services/llm-observability-service';

const { getTenantServices } = tenantServices;
const { jsonSuccess, jsonError } = responses;

export async function GET(request) {
  try {
    const { tenant, services } = await getTenantServices(request);
    const observability = createLlmObservabilityService(services.dataClient, tenant);
    const report = await observability.getUsageSummary();
    return jsonSuccess(report);
  } catch (error) {
    return jsonError(error.message || 'Failed to load LLM usage summary', 500);
  }
}
