// src/routes/achievementsRouter.js
import express from 'express';

import { getAchievementsCatalogController } from '../controllers/achievementsController.js';

const router = express.Router();

// GET ACHIEVEMENT CATALOG (all achievement types) — public, like /api/buildings
router.get('/', getAchievementsCatalogController);

export default router;
