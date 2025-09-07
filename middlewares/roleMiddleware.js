const { sendResponse } = require('../helpers/responseHelper');

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendResponse(res, false, 'Forbidden: insufficient privileges', null, null, null, null, 403);
    }
    next();
  };
}

module.exports = { authorizeRoles };
