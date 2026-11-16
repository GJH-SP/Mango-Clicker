// src/controllers/gameController.js
import { getUserById, updateUser } from '../models/users.js';
import { getBuildingById, getAllBuildings } from '../models/buildings.js';
import { addBuildingToUser, getUserBuildings } from '../models/userBuildings.js';
import { calculateClickAmount, calculateBuildingCost } from '../utils/gameBalance.js';
import { checkAndUnlockAchievements } from './achievementsController.js';

// HARVEST MANGOES (manual click — the amount is derived from the player's own
// MPS/bonuses on the server, never trusted from the client, so it can't be forged)
export const harvestController = async (req, res) => {
  try {
    const userId = req.params.id;

    let user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Click yield grows with MPS and with click_bonus achievements — see
    // src/utils/gameBalance.js
    const clickAmount = calculateClickAmount(user.mps, user.bonusClicks);

    const newMangoes = user.currentMangoes + clickAmount;
    const newTotal = user.lifetimeMangoes + clickAmount;

    user = await updateUser(userId, {
      currentMangoes: newMangoes,
      lifetimeMangoes: newTotal
    });

    // Core Mechanic 2: harvesting can push lifetime mangoes past an
    // achievement's requirement — check for and apply any new unlocks.
    const { newlyUnlocked, user: finalUser } = await checkAndUnlockAchievements(userId);
    if (finalUser) {
      user = finalUser;
    }

    return res.status(200).json({
      message: "Harvest successful",
      amountHarvested: clickAmount,
      currentMangoes: user.currentMangoes,
      lifetimeMangoes: user.lifetimeMangoes,
      mps: user.mps,
      bonusClicks: user.bonusClicks,
      clickAmount: calculateClickAmount(user.mps, user.bonusClicks),
      unlockedAchievements: newlyUnlocked
    });

  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};


// TICK (auto-generate mangoes based on MPS — called once per second by the frontend)
export const tickController = async (req, res) => {
  try {
    const userId = req.params.id;

    let user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Nothing to add if the user has no buildings yet — skip the write
    // (and skip the achievement check too, since nothing changed)
    if (!user.mps || user.mps <= 0) {
      return res.status(200).json({
        message: "No mango production yet",
        currentMangoes: user.currentMangoes,
        lifetimeMangoes: user.lifetimeMangoes,
        mps: user.mps,
        bonusClicks: user.bonusClicks,
        clickAmount: calculateClickAmount(user.mps, user.bonusClicks),
        unlockedAchievements: []
      });
    }

    const newMangoes = user.currentMangoes + user.mps;
    const newTotal = user.lifetimeMangoes + user.mps;

    user = await updateUser(userId, {
      currentMangoes: newMangoes,
      lifetimeMangoes: newTotal
    });

    // Core Mechanic 2: idle ticking alone can also cross an achievement
    // threshold — check for and apply any new unlocks.
    const { newlyUnlocked, user: finalUser } = await checkAndUnlockAchievements(userId);
    if (finalUser) {
      user = finalUser;
    }

    return res.status(200).json({
      message: "Tick successful",
      currentMangoes: user.currentMangoes,
      lifetimeMangoes: user.lifetimeMangoes,
      mps: user.mps,
      bonusClicks: user.bonusClicks,
      clickAmount: calculateClickAmount(user.mps, user.bonusClicks),
      unlockedAchievements: newlyUnlocked
    });

  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};


// BUY BUILDING
export const buyBuildingController = async (req, res) => {
  try {
    const userId = req.params.id;
    const { buildingId, quantity } = req.body;

    // Validate request body
    if (!buildingId) {
      return res.status(400).json({ error: "buildingId is required" });
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ error: "quantity must be a positive number" });
    }

    // Fetch user
    let user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch building
    const building = await getBuildingById(buildingId);
    if (!building) {
      return res.status(404).json({ error: "Building not found" });
    }

    // Calculate total cost — the unit price scales with how many of THIS
    // building the player already owns (see src/utils/gameBalance.js)
    const ownedBuildings = await getUserBuildings(userId);
    const ownedRow = ownedBuildings.find((row) => row.buildingId === buildingId);
    const ownedQuantity = ownedRow ? ownedRow.quantity : 0;

    const unitCost = calculateBuildingCost(building.baseCost, ownedQuantity);
    const totalCost = unitCost * quantity;

    if (user.currentMangoes < totalCost) {
      return res.status(400).json({ error: "Not enough mangoes to buy this building" });
    }

    // Deduct mangoes
    const updatedCurrentMangoes = user.currentMangoes - totalCost;

    // Update MPS
    const updatedMps = user.mps + (building.baseMps * quantity);

    // Update user in DB
    user = await updateUser(userId, {
      currentMangoes: updatedCurrentMangoes,
      mps: updatedMps
    });

    // Update user_buildings table
    await addBuildingToUser(userId, buildingId, quantity);

    // Core Mechanic 2: owning more of a building can cross a
    // "building_owned" achievement's requirement — check for and apply any
    // new unlocks.
    const { newlyUnlocked, user: finalUser } = await checkAndUnlockAchievements(userId);
    if (finalUser) {
      user = finalUser;
    }

    // Remove password before sending response
    const { password, ...safeUser } = user;

    return res.status(200).json({
      message: "Building purchased successfully",
      unitCost,
      totalCost,
      user: safeUser,
      clickAmount: calculateClickAmount(user.mps, user.bonusClicks),
      unlockedAchievements: newlyUnlocked
    });

  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};


// GET USER STATE
export async function getUserStateController(req, res) {
  try {
    const { id } = req.params;

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const buildings = await getUserBuildings(id);

    // Build a ready-to-render shop list: every building type, with its price
    // recalculated for how many the player already owns.
    const catalog = await getAllBuildings();
    const shop = catalog.map((building) => {
      const ownedRow = buildings.find((row) => row.buildingId === building.buildingId);
      const ownedQuantity = ownedRow ? ownedRow.quantity : 0;
      return {
        ...building,
        currentCost: calculateBuildingCost(building.baseCost, ownedQuantity),
        owned: ownedQuantity
      };
    });

    const { password, ...safeUser } = user;

    return res.json({
      user: safeUser,
      buildings,
      shop,
      clickAmount: calculateClickAmount(user.mps, user.bonusClicks)
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
}
