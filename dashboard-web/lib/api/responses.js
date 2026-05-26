function jsonSuccess(payload = {}, status = 200) {
  return Response.json({ success: true, ...payload }, { status });
}

function jsonError(message, status = 400, details) {
  return Response.json({ success: false, error: message, ...(details ? { details } : {}) }, { status });
}

function jsonNotFound(message = 'Not found') {
  return jsonError(message, 404);
}

module.exports = {
  jsonError,
  jsonNotFound,
  jsonSuccess
};
