// src/utils/gameBalance.js
//
// Central place for game-balance formulas. Tweak the constants below to
// change the difficulty curve — nothing else in the codebase needs to change.
//
// Building prices scale with how many of that SPECIFIC building type the
// player already owns — the classic incremental-game pattern (the more
// Mango Trees you have, the more the next Mango Tree costs), popularized by
// games like Cookie Clicker. Each building type has its own independent
// price curve; owning 10 Mango Trees does not raise the price of Orchard
// Workers. The manual-click amount scales with MPS instead, so clicking
// stays worthwhile even once you own a lot of buildings.

// Mangoes earned per manual click when the player has 0 MPS.
export const CLICK_BASE_AMOUNT = 1;

// Extra mangoes earned per click for every point of MPS the player has.
// Example: with a rate of 0.1, 50 MPS adds floor(50 * 0.1) = 5 bonus mangoes per click.
export const CLICK_MPS_BONUS_RATE = 0.1;

// Each unit of a building the player owns multiplies that building's NEXT
// price by this factor. 1.15 is the classic Cookie Clicker growth rate:
// the 10th unit costs roughly baseCost * 1.15^10 ≈ 4x the base price, and
// the 20th costs roughly 16x.
export const BUILDING_COST_GROWTH_RATE = 1.15;

/**
 * How many mangoes one manual click currently yields: a base amount, plus
 * a bonus that scales with MPS, plus any permanent flat bonus granted by
 * unlocked achievements (Core Mechanic 2 — see achievementsController.js).
 * @param {number} mps - The player's current mangoes-per-second.
 * @param {number} bonusClicks - Permanent flat click bonus from achievements.
 * @returns {number}
 */
export const calculateClickAmount = (mps, bonusClicks = 0) => {
  return CLICK_BASE_AMOUNT + Math.floor(mps * CLICK_MPS_BONUS_RATE) + bonusClicks;
};

/**
 * The current price of ONE unit of a building, based on how many of that
 * SAME building the player already owns. Owning 0 always returns exactly
 * baseCost (growthRate^0 === 1), so the first purchase of any building is
 * always its listed base price.
 * @param {number} baseCost - The building's base_cost column from the buildings table.
 * @param {number} ownedQuantity - How many of THIS building the player already owns.
 * @returns {number}
 */
export const calculateBuildingCost = (baseCost, ownedQuantity = 0) => {
  return Math.round(baseCost * Math.pow(BUILDING_COST_GROWTH_RATE, ownedQuantity));
};
