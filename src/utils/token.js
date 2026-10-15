const jwt = require('jsonwebtoken');
const config = require('../config/env');

// We pin the algorithm on both signing and verifying, so a forged token that claims
// a different algorithm (like "none") is rejected.
const ALGORITHM = 'HS256';

function signToken(userId) {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(userId), // the "sub" claim: who this token belongs to
    expiresIn: config.jwtExpiresIn,
    algorithm: ALGORITHM,
  });
}

// Throws if the token is invalid, tampered with, or expired.
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
