const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
const { sendResponse } = require('../helpers/responseHelper');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendResponse(res, false, 'Authorization header missing', null, null, null, null, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // attach user info
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch (err) {
    return sendResponse(res, false, 'Invalid or expired token', null, null, null, null, 401);
  }
}

module.exports = { authenticateJWT };
