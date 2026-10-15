const AppError = require('../utils/AppError');

// Usage: router.post('/register', validate(registerSchema), controller)
// Checks req.body against a Joi schema BEFORE any business logic runs.
// On success, req.body is replaced by the cleaned value (trimmed, lowercased email, ...).
function validate(schema) {
  return (req, _res, next) => {
    // In Express 5, req.body is undefined when no body was sent, hence `?? {}`.
    const { value, error } = schema.validate(req.body ?? {}, { abortEarly: false });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
    }

    req.body = value;
    return next();
  };
}

module.exports = validate;
