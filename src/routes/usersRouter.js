// src/routes/usersRouter.js
import express from 'express';

import {
  createUserController,
  loginUserController,
  getUsersController,
  getUserByIdController,
  updateUserController,
  deleteUserController
} from '../controllers/usersController.js';
import { authenticateToken, authorizeOwner } from '../middlewares/auth.js';

const router = express.Router();

// CREATE USER (register) — public
router.post('/', createUserController);

// LOGIN — public
router.post('/login', loginUserController);

// GET ALL USERS (supports ?minMangoes=) — public, read-only, no passwords ever returned
router.get('/', getUsersController);

// GET USER BY ID — public, read-only profile view
router.get('/:id', getUserByIdController);

// UPDATE USER — protected: must be logged in as this exact user
router.put('/:id', authenticateToken, authorizeOwner, updateUserController);

// DELETE USER — protected: must be logged in as this exact user
router.delete('/:id', authenticateToken, authorizeOwner, deleteUserController);

export default router;
