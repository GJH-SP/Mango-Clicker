// src/models/buildings.js
import { db } from '../db/connection.js';
import { buildings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Get all buildings
export async function getAllBuildings() {
  return await db.select().from(buildings);
}

// Get building by ID
export async function getBuildingById(id) {
  const result = await db.select().from(buildings).where(eq(buildings.buildingId, id));
  return result[0];
}
