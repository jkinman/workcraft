const { clerkAuthToTenantRequest } = require('./clerk-adapter');

function isClerkConfigured(env = process.env) {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

async function getAuthenticatedTenantRequest(request = {}, env = process.env) {
  if (!isClerkConfigured(env)) {
    return request;
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const authResult = await auth();
    const tenantRequest = clerkAuthToTenantRequest(authResult);

    return {
      ...request,
      ...tenantRequest
    };
  } catch (error) {
    if (env.CAREER_OPS_TENANT_MODE === 'hosted' || env.NODE_ENV === 'production') {
      throw error;
    }

    return request;
  }
}

module.exports = {
  getAuthenticatedTenantRequest,
  isClerkConfigured
};
