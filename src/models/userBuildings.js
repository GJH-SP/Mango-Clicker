// src/models/userBuildings.js
import { db } from '../db/connection.js';
import { userBuildings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Get all buildings owned by a user
export async function getUserBuildings(userId) {
  return await db.select().from(userBuildings).where(eq(userBuildings.userId, userId));
}

// Add or update building quantity
export async function addBuildingToUser(userId, buildingId, quantity) {
  // Check if user already owns this building
  const existing = await db.select()
    .from(userBuildings)
    .where(and(eq(userBuildings.userId, userId), eq(userBuildings.buildingId, buildingId)));

  if (existing.length > 0) {
    // Update quantity
    return await db.update(userBuildings)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(userBuildings.userBuildingId, existing[0].userBuildingId))
      .returning();
  }

  // Insert new row
  return await db.insert(userBuildings)
    .values({
      userId,
      buildingId,
      quantity
    })
    .returning();
}
