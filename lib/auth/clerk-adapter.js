function clerkAuthToTenantRequest(authResult) {
  const userId = authResult?.userId;
  if (!userId) {
    return {};
  }

  return {
    auth: {
      tenantId: userId
    }
  };
}

module.exports = {
  clerkAuthToTenantRequest
};
