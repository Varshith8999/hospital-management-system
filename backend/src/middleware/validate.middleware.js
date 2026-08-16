'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs a list of express-validator chains and converts failures into a 422.
 * Usage: router.post('/', validate([body('email').isEmail()]), handler)
 */
function validate(validations) {
  return async (req, _res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const details = result.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return next(ApiError.unprocessable('Validation failed', details));
  };
}

module.exports = { validate };
