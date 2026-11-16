// src/controllers/usersController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import {
  createUser,
  getAllUsers,
  getUsersByMinMangoes,
  getUserById,
  getUserByUsername,
  updateUser,
  deleteUser
} from '../models/users.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const SALT_ROUNDS = 10;

/** Sign a JWT for a user row. Payload is intentionally minimal (no password). */
const signToken = (user) => {
  return jwt.sign(
    { userId: user.userId, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// CREATE USER (register) — hashes the password with bcrypt before storing it,
// and logs the new player straight in by returning a token too.
export async function createUserController(req, res) {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  if (!password) {
    return res.status(400).json({ error: "password is required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser(username, passwordHash);
    const { password: _pw, ...safeUser } = user;

    const token = signToken(safeUser);
    return res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "username already exists" });
    }
    return res.status(500).json({ error: err.message });
  }
}

// LOGIN — verifies the password against its bcrypt hash and issues a JWT.
// Passwords are never stored or returned in plaintext.
export async function loginUserController(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const user = await getUserByUsername(username);

    // Same error for "no such user" and "wrong password" so we don't leak
    // which usernames exist.
    if (!user) {
      return res.status(401).json({ error: "invalid username or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "invalid username or password" });
    }

    const { password: _pw, ...safeUser } = user;
    const token = signToken(safeUser);
    return res.status(200).json({ token, user: safeUser });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

// GET ALL USERS (with optional ?minMangoes=) — public read-only list, passwords
// are never included in the response.
export async function getUsersController(req, res) {
  const { minMangoes } = req.query;

  try {
    const users = minMangoes
      ? await getUsersByMinMangoes(Number(minMangoes))
      : await getAllUsers();

    const safeUsers = users.map(({ password, ...safeUser }) => safeUser);
    return res.json(safeUsers);
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

// GET USER BY ID — public read-only profile view.
export async function getUserByIdController(req, res) {
  try {
    const { id } = req.params;

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const { password, ...safeUser } = user;
    return res.json(safeUser);
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

// UPDATE USER — protected route (see usersRouter.js): only the logged-in
// owner of this account can reach this controller. If a new password is
// included, it's re-hashed before saving.
export async function updateUserController(req, res) {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no update fields provided" });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updated = await updateUser(id, data);
    const { password, ...safeUser } = updated;
    return res.json(safeUser);
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "username already exists" });
    }
    return res.status(500).json({ error: err.message });
  }
}

// DELETE USER — protected route (see usersRouter.js): only the logged-in
// owner of this account can reach this controller.
export async function deleteUserController(req, res) {
  try {
    const { id } = req.params;

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    await deleteUser(id);
    return res.status(204).send();
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
}
