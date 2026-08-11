const { env } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: 'API endpoint not found.' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = error.status || (error.code === 'SQLITE_CONSTRAINT' ? 409 : 500);
  if (status >= 500) console.error('Request failed:', error.message);
  const body = { message: error.publicMessage || (status >= 500 ? 'Internal server error.' : error.message) };
  if (env.NODE_ENV !== 'production' && status >= 500) body.detail = error.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
