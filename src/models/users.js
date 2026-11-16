// src/models/users.js
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq, gte } from 'drizzle-orm';

// Create a new user
export async function createUser(username, password) {
  const result = await db.insert(users).values({
    username,
    password,
    currentMangoes: 0,
    lifetimeMangoes: 0,
    mps: 0
  }).returning();

  return result[0];
}

// Get all users
export async function getAllUsers() {
  return await db.select().from(users);
}

// Get users with min mangoes (query param example)
export async function getUsersByMinMangoes(min) {
  return await db.select().from(users).where(gte(users.currentMangoes, min));
}

// Get user by ID
export async function getUserById(id) {
  const result = await db.select().from(users).where(eq(users.userId, id));
  return result[0];
}

// Get user by username (used for login)
export async function getUserByUsername(username) {
  const result = await db.select().from(users).where(eq(users.username, username));
  return result[0];
}

// Update user (e.g., username or stats)
export async function updateUser(id, data) {
  const result = await db.update(users)
    .set(data)
    .where(eq(users.userId, id))
    .returning();

  return result[0];
}

// Delete user
export async function deleteUser(id) {
  await db.delete(users).where(eq(users.userId, id));
}
