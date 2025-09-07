const { sendResponse } = require('../helpers/responseHelper');

function errorHandler(err, req, res, next) {
  console.error(err);
  const message = err.message || 'Internal Server Error';
  sendResponse(res, false, message, null, null, null, err.stack, 500);
}

module.exports = errorHandler;
