// Every error response in the API uses ONE shape:
// { "error": { "code": "...", "message": "...", "details": [] } }
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Runs when no route matched the request.
function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises an error handler by its 4 parameters, so `_next` must stay
// even though we do not use it.
function errorHandler(err, req, res, _next) {
  // Request body was not valid JSON.
  if (err.type === 'entity.parse.failed') {
    err = new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  // Request body was larger than our size limit.
  if (err.type === 'entity.too.large') {
    err = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Anything else is a bug. Log the details for us, but do NOT leak them to the client.
  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', details: [] },
  });
}

module.exports = { notFound, errorHandler };
