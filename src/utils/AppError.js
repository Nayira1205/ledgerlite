// An error we throw on purpose for expected problems (bad input, not found, ...).
// The error handler turns it into a clean JSON response with the right HTTP status.
class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
