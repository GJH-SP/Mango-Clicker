// src/controllers/achievementsController.js
//
// Core Mechanic 2: Achievements.
//
// This is what makes the two mechanics interact, not just coexist:
//   - Progress in Mechanic 1 (harvesting mangoes, buying buildings) is what
//     unlocks achievements.
//   - Unlocking an achievement permanently boosts Mechanic 1's numbers
//     (extra MPS or extra mangoes per click), which makes future harvesting
//     and buying faster.
//
// checkAndUnlockAchievements() is called from harvestController,
// tickController, and buyBuildingController (in gameController.js) right
// after they change the user's state, so achievements unlock the moment
// they're earned rather than needing a separate poll.

import { getUserById, updateUser } from '../models/users.js';
import { getUserBuildings } from '../models/userBuildings.js';
import { getAllAchievements } from '../models/achievements.js';
import { getUserAchievements, unlockAchievement } from '../models/userAchievements.js';

/** How far a user currently is toward one achievement's requirement. */
const getProgressForAchievement = (achievement, user, ownedBuildings) => {
  if (achievement.requirementType === 'building_owned') {
    const ownedRow = ownedBuildings.find((row) => row.buildingId === achievement.requirementBuildingId);
    return ownedRow ? ownedRow.quantity : 0;
  }
  // 'lifetime_mangoes' (default)
  return user.lifetimeMangoes;
};

/**
 * Checks every achievement the user hasn't unlocked yet, unlocks any whose
 * requirement is now met, and permanently applies their reward to the user
 * (extra MPS or extra mangoes per click).
 *
 * @param {number|string} userId
 * @returns {Promise<{newlyUnlocked: Array, user: Object|null}>}
 *   `user` is the user's current row — updated if any achievement unlocked,
 *   otherwise unchanged. `newlyUnlocked` is empty if nothing new unlocked.
 */
export const checkAndUnlockAchievements = async (userId) => {
  let user = await getUserById(userId);
  if (!user) {
    return { newlyUnlocked: [], user: null };
  }

  const [catalog, unlockedRows, ownedBuildings] = await Promise.all([
    getAllAchievements(),
    getUserAchievements(userId),
    getUserBuildings(userId)
  ]);

  const unlockedIds = new Set(unlockedRows.map((row) => row.achievementId));
  const newlyUnlocked = [];
  let mpsGain = 0;
  let clickBonusGain = 0;

  for (const achievement of catalog) {
    if (unlockedIds.has(achievement.achievementId)) {
      continue;
    }

    const progress = getProgressForAchievement(achievement, user, ownedBuildings);
    if (progress < achievement.requirementAmount) {
      continue;
    }

    await unlockAchievement(userId, achievement.achievementId);
    newlyUnlocked.push(achievement);

    if (achievement.rewardType === 'mps_bonus') {
      mpsGain += achievement.rewardAmount;
    } else if (achievement.rewardType === 'click_bonus') {
      clickBonusGain += achievement.rewardAmount;
    }
  }

  if (mpsGain > 0 || clickBonusGain > 0) {
    user = await updateUser(userId, {
      mps: user.mps + mpsGain,
      bonusClicks: user.bonusClicks + clickBonusGain
    });
  }

  return { newlyUnlocked, user };
};

// GET ACHIEVEMENT CATALOG — public, like /api/buildings (static reference data)
export const getAchievementsCatalogController = async (req, res) => {
  try {
    const catalog = await getAllAchievements();
    return res.json(catalog);
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};

// GET USER ACHIEVEMENTS — protected: the catalog, annotated with this
// user's progress and unlocked/locked status for each achievement.
export const getUserAchievementsController = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const [catalog, unlockedRows, ownedBuildings] = await Promise.all([
      getAllAchievements(),
      getUserAchievements(id),
      getUserBuildings(id)
    ]);

    const unlockedMap = new Map(unlockedRows.map((row) => [row.achievementId, row.unlockedAt]));

    const achievementsWithProgress = catalog.map((achievement) => {
      const progress = getProgressForAchievement(achievement, user, ownedBuildings);
      return {
        ...achievement,
        progress: Math.min(progress, achievement.requirementAmount),
        unlocked: unlockedMap.has(achievement.achievementId),
        unlockedAt: unlockedMap.get(achievement.achievementId) || null
      };
    });

    return res.json({ achievements: achievementsWithProgress });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};
