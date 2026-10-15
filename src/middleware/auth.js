const mongoose = require('mongoose');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/token');

// Put this before any route that needs a logged-in user:
//   router.get('/me', authenticate, controller)
// It expects:  Authorization: Bearer <token>
// On success it sets req.user to the user's database record.
const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    // Covers bad signature, garbage, and expired tokens alike.
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  if (!mongoose.isValidObjectId(payload.sub)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  // Look the user up every time: a deleted user's old token must stop working.
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  req.user = user;
  return next();
});

module.exports = { authenticate };
