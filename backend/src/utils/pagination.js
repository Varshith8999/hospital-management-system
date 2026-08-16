'use strict';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/** Normalises ?page= and ?limit= query params into Sequelize offset/limit. */
function getPagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

/** Wraps a findAndCountAll result in a consistent paginated envelope. */
function paginatedResponse({ count, rows }, { page, limit }) {
  const total = Array.isArray(count) ? count.length : count;
  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = { getPagination, paginatedResponse, DEFAULT_LIMIT, MAX_LIMIT };
