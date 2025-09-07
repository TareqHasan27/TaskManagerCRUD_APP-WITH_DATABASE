const express = require('express');
const morgan = require('morgan');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middlewares/errorMiddleware');
const { sendResponse } = require('./helpers/responseHelper');


// routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// 404
app.use((req, res) => {
  sendResponse(res, false, 'Route not found', null, null, null, null, 404);
});

// error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
