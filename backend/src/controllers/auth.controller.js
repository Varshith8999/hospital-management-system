'use strict';

const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    ...result,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ success: true, message: 'Login successful', ...result });
});

/**
 * Stateless JWT logout: the client discards the token. The endpoint exists so
 * the frontend has a single place to call and so the action can be audited.
 */
const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.status(200).json({ success: true, ...result });
});

const me = asyncHandler(async (req, res) => {
  const result = await authService.me(req.user);
  res.status(200).json({ success: true, ...result });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ success: true, message: 'Password updated successfully' });
});

module.exports = { register, login, logout, refresh, me, changePassword };
