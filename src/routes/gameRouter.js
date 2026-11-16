// src/routes/gameRouter.js
import express from 'express';

import {
  harvestController,
  buyBuildingController,
  getUserStateController,
  tickController
} from '../controllers/gameController.js';
import { getUserAchievementsController } from '../controllers/achievementsController.js';
import { authenticateToken, authorizeOwner } from '../middlewares/auth.js';

const router = express.Router();

// Every game route acts on a specific user's own state, so all of them
// require a valid token AND that the token belongs to :id.
router.use('/:id', authenticateToken, authorizeOwner);

// HARVEST MANGOES (manual clicking)
router.post('/:id/harvest', harvestController);

// TICK (auto-generate mangoes from MPS, called every second by the frontend)
router.post('/:id/tick', tickController);

// BUY BUILDING
router.post('/:id/buy-building', buyBuildingController);

// GET FULL USER STATE
router.get('/:id/state', getUserStateController);

// GET THIS USER'S ACHIEVEMENT PROGRESS (Core Mechanic 2)
router.get('/:id/achievements', getUserAchievementsController);

export default router;
