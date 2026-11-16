// src/models/achievements.js
import { db } from '../db/connection.js';
import { achievements } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Get the full achievements catalog
export async function getAllAchievements() {
  return await db.select().from(achievements);
}

// Get one achievement by ID
export async function getAchievementById(id) {
  const result = await db.select().from(achievements).where(eq(achievements.achievementId, id));
  return result[0];
}
