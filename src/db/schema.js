// ✏️ EDIT THIS FILE — add your own table schemas below the example `tasks` table.
// After adding a new table, run `npm run db` to recreate the database.

/**
 * All table schemas live here. Add new tables below and run `npm run db` to apply.
 */

import crypto from 'crypto';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** Tasks table. */
// export const tasks = sqliteTable('tasks', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   title: text('title').notNull(),
//   completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
//   createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
// });

/** Users table */
export const users = sqliteTable('users', {
  userId: integer('user_id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  currentMangoes: integer('current_mangoes').notNull().default(0),
  lifetimeMangoes: integer('lifetime_mangoes').notNull().default(0),
  mps: integer('mps').notNull().default(0),
  // Permanent flat bonus to every manual click, granted by unlocked
  // achievements (Core Mechanic 2) — stacks on top of the MPS-based click
  // bonus from calculateClickAmount(). See src/utils/gameBalance.js.
  bonusClicks: integer('bonus_clicks').notNull().default(0)
});

/** Buildings table */
export const buildings = sqliteTable('buildings', {
  buildingId: text('building_id').primaryKey(),
  name: text('name').notNull(),
  baseCost: integer('base_cost').notNull(),
  baseMps: integer('base_mps').notNull()
});

/** User-Buildings table */
export const userBuildings = sqliteTable('user_buildings', {
  userBuildingId: text('user_building_id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),

  buildingId: text('building_id')
    .notNull()
    .references(() => buildings.buildingId),

  quantity: integer('quantity').notNull().default(0)
});

/**
 * Achievements catalog (Core Mechanic 2) — static reference data, one row
 * per achievement type, similar in spirit to the buildings table.
 *
 * requirementType is one of:
 *   'lifetime_mangoes' — unlocked once the user's lifetimeMangoes reaches requirementAmount.
 *   'building_owned'   — unlocked once the user owns requirementAmount of requirementBuildingId.
 *
 * rewardType is one of:
 *   'mps_bonus'   — permanently adds rewardAmount to the user's mps.
 *   'click_bonus' — permanently adds rewardAmount to the user's bonusClicks.
 */
export const achievements = sqliteTable('achievements', {
  achievementId: text('achievement_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  requirementType: text('requirement_type').notNull(),
  requirementBuildingId: text('requirement_building_id')
    .references(() => buildings.buildingId),
  requirementAmount: integer('requirement_amount').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardAmount: integer('reward_amount').notNull()
});

/**
 * User-Achievements table — records which achievements each user has
 * unlocked and when. Foreign keys to both users and achievements.
 */
export const userAchievements = sqliteTable('user_achievements', {
  userAchievementId: text('user_achievement_id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),

  achievementId: text('achievement_id')
    .notNull()
    .references(() => achievements.achievementId),

  unlockedAt: text('unlocked_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
});


