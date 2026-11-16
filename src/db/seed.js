// ✏️ EDIT THIS FILE — add seed data for your own tables below the example tasks.

/**
 * Seed data and database reset script. Run with: npm run db
 *
 * To add your own seed data:
 *   1. Import your table schema from './schema.js'
 *   2. Add a sample data array
 *   3. Insert it inside the seed() function with db.insert()
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import your table schemas here
import { buildings, achievements } from './schema.js';


// --- Seed data ---

/** Sample tasks inserted when the database is reset. */

/** Mango Clicker buildings */
const sampleBuildings = [
  {
    buildingId: "mango_tree",
    name: "Mango Tree",
    baseCost: 10,
    baseMps: 1
  },
  {
    buildingId: "orchard_worker",
    name: "Orchard Worker",
    baseCost: 100,
    baseMps: 5
  },
  {
    buildingId: "mango_factory",
    name: "Mango Factory",
    baseCost: 1000,
    baseMps: 25
  },
  {
    buildingId: "mango_mine",
    name: "Mango Mine",
    baseCost: 10000,
    baseMps: 70
  },
  {
    buildingId: "mango_laboratory",
    name: "Mango Laboratory",
    baseCost: 100000,
    baseMps: 150
  },
  {
    buildingId: "mango_spaceship",
    name: "Mango Spaceship",
    baseCost: 1000000,
    baseMps: 500
  },
  {
    buildingId: "mango_planet",
    name: "Mango Planet",
    baseCost: 10000000,
    baseMps: 2500
  },
  {
    buildingId: "mango_god",
    name: "Mango God",
    baseCost: 100000000,
    baseMps: 10000
  }
];

/**
 * Mango Clicker achievements (Core Mechanic 2). Each one unlocks once its
 * requirement is met and permanently grants its reward — see
 * checkAndUnlockAchievements() in src/controllers/achievementsController.js.
 */
const sampleAchievements = [
  {
    achievementId: "first_harvest",
    name: "First Harvest",
    description: "Harvest your very first mango.",
    requirementType: "lifetime_mangoes",
    requirementBuildingId: null,
    requirementAmount: 1,
    rewardType: "click_bonus",
    rewardAmount: 1
  },
  {
    achievementId: "century_club",
    name: "Century Club",
    description: "Reach 100 lifetime mangoes.",
    requirementType: "lifetime_mangoes",
    requirementBuildingId: null,
    requirementAmount: 100,
    rewardType: "click_bonus",
    rewardAmount: 2
  },
  {
    achievementId: "mango_millionaire",
    name: "Mango Millionaire",
    description: "Reach 1,000,000 lifetime mangoes.",
    requirementType: "lifetime_mangoes",
    requirementBuildingId: null,
    requirementAmount: 1000000,
    rewardType: "mps_bonus",
    rewardAmount: 50
  },
  {
    achievementId: "sapling_starter",
    name: "Sapling Starter",
    description: "Own 5 Mango Trees.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_tree",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 5
  },
  {
    achievementId: "workforce_assembled",
    name: "Workforce Assembled",
    description: "Own 10 Orchard Workers.",
    requirementType: "building_owned",
    requirementBuildingId: "orchard_worker",
    requirementAmount: 10,
    rewardType: "mps_bonus",
    rewardAmount: 25
  },
  {
    achievementId: "factory_line",
    name: "Factory Line",
    description: "Own 5 Mango Factories.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_factory",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 100
  },
  {
    achievementId: "mine_master",
    name: "Mine Master",
    description: "Own 5 Mango Mines.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_mine",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 250
  },
  {
    achievementId: "Scientific_Success",
    name: "Scientific Success",
    description: "Own 5 Laboratories.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_laboratory",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 500
  },
  {
    achievementId: "Out of this World",
    name: "Out of this World",
    description: "Own 5 Mango Spaceships.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_spaceship",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 750
  },
  {
    achievementId: "a_new_beginning?",
    name: "A New Beginning?",
    description: "Own 5 Mango Planets.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_planet",
    requirementAmount: 5,
    rewardType: "mps_bonus",
    rewardAmount: 1000
  },
  {
    achievementId: "the_one_and_only",
    name: "You are the Mango God",
    description: "Own 1 Mango God.",
    requirementType: "building_owned",
    requirementBuildingId: "mango_god",
    requirementAmount: 1,
    rewardType: "mps_bonus",
    rewardAmount: 10000
  }
];


// --- Seed function ---

/** Insert seed data into the database. */
// Insert Mango Clicker buildings and achievements
export const seed = async (db) => {
  await db.insert(buildings).values(sampleBuildings);
  console.log(`  Inserted ${sampleBuildings.length} buildings`);

  await db.insert(achievements).values(sampleAchievements);
  console.log(`  Inserted ${sampleAchievements.length} achievements`);
};

// --- Database reset (no need to modify below) ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const dbPath = dbUrl.replace('file:', '');
const absoluteDbPath = path.resolve(projectRoot, dbPath);

const resetDatabase = async () => {
  try {
    // Step 1 — Delete the old database file
    if (fs.existsSync(absoluteDbPath)) {
      fs.unlinkSync(absoluteDbPath);
      console.log(`Deleted old database: ${dbPath}`);
    }

    // Step 2 — Recreate tables from schema.js
    console.log('Creating tables from schema...');
    execSync('npx drizzle-kit push', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Step 3 — Insert seed data
    console.log('Seeding database...');
    const { db } = await import('./connection.js');
    await seed(db);

    console.log('Done! Database is ready.');
  } catch (error) {
    console.error('Failed to reset database:', error.message);
    process.exit(1);
  }
};

resetDatabase();
