'use strict';

const ApiError = require('../utils/ApiError');
const config = require('../config');

/** 404 handler for unmatched routes. */
function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Global error handler. Translates Sequelize / JWT / body-parser errors into a
 * consistent JSON envelope and never leaks internals in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.name === 'SequelizeValidationError') {
      error = ApiError.unprocessable(
        'Validation failed',
        error.errors.map((e) => ({ field: e.path, message: e.message }))
      );
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      error = ApiError.conflict(
        'A record with these details already exists',
        (error.errors || []).map((e) => ({ field: e.path, message: `${e.path} must be unique` }))
      );
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      error = ApiError.badRequest('Related record does not exist or is still in use');
    } else if (error.name === 'SequelizeDatabaseError') {
      error = ApiError.badRequest('Invalid data supplied');
    } else if (error.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid authentication token');
    } else if (error.type === 'entity.parse.failed') {
      error = ApiError.badRequest('Malformed JSON body');
    } else {
      error = new ApiError(error.statusCode || 500, error.message || 'Internal server error');
      error.isOperational = false;
    }
  }

  const statusCode = error.statusCode || 500;

  // Log the full error server-side; never ship internals to the client.
  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err); // eslint-disable-line no-console
  }

  const body = {
    success: false,
    message:
      statusCode >= 500 && config.isProduction
        ? 'Something went wrong. Please try again later.'
        : error.message,
  };

  if (error.details) body.errors = error.details;
  if (!config.isProduction && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
