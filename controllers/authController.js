const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config({path: "../.env"});
const { sendResponse } = require('../helpers/responseHelper');

const SALT_ROUNDS = 10;

async function register(req, res) {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return sendResponse(res, false, 'username, email and password are required', null, null, ['Missing fields'], null, 400);
  }

  try {
    // check uniqueness
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email]);
    if (existing.length > 0) {
      return sendResponse(res, false, 'Username or email already exists', null, null, ['Duplicate username/email'], null, 409);
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role === 'admin' ? 'admin' : 'user';

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashed, userRole]
    );

    const userId = result.insertId;
    const token = jwt.sign({ id: userId, username, role: userRole }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    sendResponse(res, true, 'User registered', { id: userId, username, email, role: userRole, token }, null, null, null, 201);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Registration failed', null, null, null, err.message, 500);
  }
}

async function login(req, res) {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return sendResponse(res, false, 'usernameOrEmail and password required', null, null, ['Missing fields'], null, 400);
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, password, role FROM users WHERE username = ? OR email = ? LIMIT 1',
      [usernameOrEmail, usernameOrEmail]
    );
    if (rows.length === 0) {
      return sendResponse(res, false, 'Invalid credentials', null, null, null, null, 401);
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendResponse(res, false, 'Invalid credentials', null, null, null, null, 401);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    sendResponse(res, true, 'Login successful', { id: user.id, username: user.username, email: user.email, role: user.role, token }, null, null, null, 200);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Login failed', null, null, null, err.message, 500);
  }
}

module.exports = { register, login };
