// src/routes/buildingsRouter.js
import express from 'express';

import { getBuildingsController } from '../controllers/buildingsController.js';

const router = express.Router();

// GET ALL BUILDINGS (shop catalog)
router.get('/', getBuildingsController);

export default router;
