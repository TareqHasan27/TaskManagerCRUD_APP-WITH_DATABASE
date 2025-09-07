const pool = require('../config/db');
const { sendResponse } = require('../helpers/responseHelper');

const VALID_STATUSES = ['To Do','In Progress','Completed'];

// Helper: validate input for create/update
function validateTaskInput({ title, status }, isUpdate = false) {
  const errors = [];
  if (!isUpdate) {
    if (!title || title.trim() === '') errors.push('Title is required');
    if (!status || !VALID_STATUSES.includes(status)) errors.push('Invalid status');
  } else {
    if (title !== undefined && title.trim() === '') errors.push('Title cannot be empty');
    if (status !== undefined && !VALID_STATUSES.includes(status)) errors.push('Invalid status');
  }
  return errors;
}

async function getAllTasks(req, res) {
  try {
    // Query params
    const { status, search, sortBy, order = 'asc', title } = req.query;
    const whereParts = [];
    const params = [];

    // If user is regular, restrict to their tasks
    if (req.user.role !== 'admin') {
      whereParts.push('t.user_id = ?');
      params.push(req.user.id);
    }

    // status filter
    if (status) {
      whereParts.push('t.status = ?');
      params.push(status);
    }

    // exact title filter (optional)
    if (title) {
      whereParts.push('LOWER(t.title) = ?');
      params.push(title.toLowerCase());
    }

    // search (partial)
    if (search) {
      whereParts.push('(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ?)');
      const s = `%${search.toLowerCase()}%`;
      params.push(s, s);
    }

    // build SQL
    let sql = `SELECT t.id, t.title, t.description, t.status, t.user_id, t.created_at, t.updated_at, u.username, u.email
               FROM tasks t
               JOIN users u ON u.id = t.user_id`;

    if (whereParts.length) {
      sql += ' WHERE ' + whereParts.join(' AND ');
    }

    // valid sort columns
    const allowedSort = ['title','status','created_at','updated_at'];
    if (sortBy && allowedSort.includes(sortBy)) {
      sql += ` ORDER BY t.${sortBy} ${order.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ' ORDER BY t.id DESC';
    }

    const [rows] = await pool.execute(sql, params);
    // If user is admin and wants to see stats etc, that can be added separately
    sendResponse(res, true, 'Tasks retrieved successfully', rows, rows.length);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to get tasks', null, null, null, err.message, 500);
  }
}

async function getTaskById(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const [rows] = await pool.execute(
      `SELECT t.*, u.username, u.email FROM tasks t JOIN users u ON u.id = t.user_id WHERE t.id = ? LIMIT 1`,
      [taskId]
    );
    if (rows.length === 0) return sendResponse(res, false, 'Task not found', null, null, null, null, 404);
    const task = rows[0];

    // authorize: only owner or admin
    if (req.user.role !== 'admin' && task.user_id !== req.user.id) {
      return sendResponse(res, false, 'Forbidden', null, null, null, null, 403);
    }

    sendResponse(res, true, 'Task retrieved successfully', task);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to get task', null, null, null, err.message, 500);
  }
}

async function createTask(req, res) {
  try {
    const { title, description, status } = req.body;
    const errors = validateTaskInput({ title, status }, false);
    if (errors.length) return sendResponse(res, false, 'Validation failed', null, null, errors, null, 400);

    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, status) VALUES (?, ?, ?, ?)',
      [req.user.id, title, description || '', status]
    );

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [result.insertId]);
    sendResponse(res, true, 'Task created successfully', rows[0], null, null, null, 201);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to create task', null, null, null, err.message, 500);
  }
}

async function updateTask(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const { title, description, status } = req.body;
    const errors = validateTaskInput({ title, status }, true);
    if (errors.length) return sendResponse(res, false, 'Validation failed', null, null, errors, null, 400);

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    if (rows.length === 0) return sendResponse(res, false, 'Task not found', null, null, null, null, 404);
    const task = rows[0];

    // authorize
    if (req.user.role !== 'admin' && task.user_id !== req.user.id) {
      return sendResponse(res, false, 'Forbidden', null, null, null, null, 403);
    }

    // Build update dynamically
    const updates = [];
    const params = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return sendResponse(res, false, 'No fields to update', null, null, null, null, 400);

    params.push(taskId);
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(sql, params);

    const [updatedRows] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    sendResponse(res, true, 'Task updated successfully', updatedRows[0]);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to update task', null, null, null, err.message, 500);
  }
}

async function updateTaskStatus(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return sendResponse(res, false, 'Invalid status', null, null, null, null, 400);
    }

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    if (rows.length === 0) return sendResponse(res, false, 'Task not found', null, null, null, null, 404);
    const task = rows[0];

    if (req.user.role !== 'admin' && task.user_id !== req.user.id) {
      return sendResponse(res, false, 'Forbidden', null, null, null, null, 403);
    }

    await pool.execute('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId]);
    const [updated] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    sendResponse(res, true, 'Task status updated successfully', updated[0]);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to update task status', null, null, null, err.message, 500);
  }
}

async function deleteTask(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    if (rows.length === 0) return sendResponse(res, false, 'Task not found', null, null, null, null, 404);
    const task = rows[0];

    if (req.user.role !== 'admin' && task.user_id !== req.user.id) {
      return sendResponse(res, false, 'Forbidden', null, null, null, null, 403);
    }

    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    sendResponse(res, true, 'Task deleted successfully', task);
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to delete task', null, null, null, err.message, 500);
  }
}

async function getStats(req, res) {
  try {
    if (req.user.role === 'admin') {
      // global stats
      const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM tasks');
      const [todoRows] = await pool.execute("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'To Do'");
      const [inProgressRows] = await pool.execute("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'In Progress'");
      const [completedRows] = await pool.execute("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'Completed'");
      const stats = {
        total: totalRows[0].total,
        toDo: todoRows[0].cnt,
        inProgress: inProgressRows[0].cnt,
        completed: completedRows[0].cnt
      };
      return sendResponse(res, true, 'Statistics retrieved', stats);
    } else {
      // per-user stats
      const [statsRows] = await pool.execute(`
        SELECT 
          SUM(CASE WHEN status='To Do' THEN 1 ELSE 0 END) as toDo,
          SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed,
          COUNT(*) as total
        FROM tasks WHERE user_id = ?`, [req.user.id]);
      return sendResponse(res, true, 'Statistics retrieved', statsRows[0]);
    }
  } catch (err) {
    console.error(err);
    sendResponse(res, false, 'Failed to get stats', null, null, null, err.message, 500);
  }
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getStats
};
