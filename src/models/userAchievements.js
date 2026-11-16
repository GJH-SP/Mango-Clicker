// src/models/userAchievements.js
import { db } from '../db/connection.js';
import { userAchievements } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Get all achievements a user has unlocked
export async function getUserAchievements(userId) {
  return await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
}

// Check whether a user has already unlocked a specific achievement
export async function hasUnlockedAchievement(userId, achievementId) {
  const result = await db.select()
    .from(userAchievements)
    .where(and(
      eq(userAchievements.userId, userId),
      eq(userAchievements.achievementId, achievementId)
    ));

  return result.length > 0;
}

// Record that a user has unlocked an achievement
export async function unlockAchievement(userId, achievementId) {
  const result = await db.insert(userAchievements).values({ userId, achievementId }).returning();
  return result[0];
}
