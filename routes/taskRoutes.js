const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateJWT } = require('../middlewares/authMiddleware');

// check auth for all task routes
router.use(authenticateJWT);

router.get('/', taskController.getAllTasks);
router.get('/stats', taskController.getStats);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.updateTaskStatus);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
