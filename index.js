// ✏️ EDIT THIS FILE — register your new routes here (before the error handler).
// Look for the comment "Add your routes here" below.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { setupSwagger } from './_extras/api-docs/swagger.js';
import { errorHandler } from './src/utils/_errors.js';
import usersRouter from './src/routes/usersRouter.js';
import gameRouter from './src/routes/gameRouter.js';
import buildingsRouter from './src/routes/buildingsRouter.js';
import achievementsRouter from './src/routes/achievementsRouter.js';

const app = express();

// Middleware
// The frontend now runs on its own dev server (Vite, default port 5173),
// separate from this API server — so CORS must be configured explicitly
// rather than relying on same-origin requests.
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Add your routes here — before the error handler, like this:
app.use('/api/users', usersRouter);
app.use('/api/game', gameRouter);
app.use('/api/buildings', buildingsRouter);
app.use('/api/achievements', achievementsRouter);
// app.use('/api/your-resource', yourRoutes);

// Swagger API docs
await setupSwagger(app);

// Global error handler (must be last)
app.use(errorHandler);

// Only listen when run directly (not imported for testing)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api-docs`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port by setting the PORT environment variable.`);
    process.exit(1);
  }
  throw err;
});

export default app;
