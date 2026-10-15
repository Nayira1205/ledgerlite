// Express can only catch errors from async functions if we hand them to next().
// This wrapper does that for us, so a thrown AppError reaches the error handler.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
