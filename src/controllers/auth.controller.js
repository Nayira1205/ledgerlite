// Controllers only translate HTTP <-> service calls. No business rules here.
const authService = require('../services/auth.service');
const config = require('../config/env');

async function register(req, res) {
  const user = await authService.register(req.body);
  res.status(201).json({ user });
}

async function login(req, res) {
  const { token, user } = await authService.login(req.body);
  res.status(200).json({
    token,
    tokenType: 'Bearer',
    expiresIn: config.jwtExpiresIn,
    user,
  });
}

function me(req, res) {
  res.status(200).json({ user: req.user });
}

module.exports = { register, login, me };
