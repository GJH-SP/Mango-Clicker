/**
 * Achievement Card Component
 *
 * Renders one row in the Achievements panel: the achievement's name,
 * description, its reward, and either a progress bar (locked) or an
 * unlocked badge. Progress is computed by the caller (main.js) from data
 * it already has client-side (currentUser.lifetimeMangoes / shop owned
 * counts) — this component just displays whatever numbers it's given.
 *
 * Usage:
 *   import { createAchievementCard } from './components/achievement-card.js';
 *   const li = createAchievementCard(achievement, progress);
 *   document.getElementById('achievement-list').appendChild(li);
 */

/** Human-readable label for what an achievement's reward does. */
const describeReward = (achievement) => {
  if (achievement.rewardType === 'mps_bonus') {
    return `+${achievement.rewardAmount} MPS`;
  }
  return `+${achievement.rewardAmount} per click`;
};

/**
 * Create a list item element for a single achievement.
 *
 * @param {Object} achievement - One entry from the `achievements` array
 *   returned by `GET /api/game/:id/achievements`.
 * @param {string} achievement.achievementId
 * @param {string} achievement.name
 * @param {string} achievement.description
 * @param {number} achievement.requirementAmount
 * @param {string} achievement.rewardType - 'mps_bonus' | 'click_bonus'
 * @param {number} achievement.rewardAmount
 * @param {boolean} achievement.unlocked
 * @param {number} progress - The player's current progress toward requirementAmount.
 * @returns {HTMLLIElement}
 */
export const createAchievementCard = (achievement, progress) => {
  const li = document.createElement('li');
  li.classList.add('achievement-card', achievement.unlocked ? 'unlocked' : 'locked');

  const header = document.createElement('div');
  header.classList.add('achievement-header');

  const title = document.createElement('div');
  title.classList.add('achievement-title');

  const badge = document.createElement('span');
  badge.classList.add('achievement-badge');
  badge.textContent = achievement.unlocked ? '🏆' : '🔒';

  const name = document.createElement('span');
  name.textContent = achievement.name;

  title.appendChild(badge);
  title.appendChild(name);

  const reward = document.createElement('span');
  reward.classList.add('achievement-reward');
  reward.textContent = describeReward(achievement);

  header.appendChild(title);
  header.appendChild(reward);

  const description = document.createElement('p');
  description.classList.add('achievement-description');
  description.textContent = achievement.description;

  const progressTrack = document.createElement('div');
  progressTrack.classList.add('achievement-progress-track');

  const progressFill = document.createElement('div');
  progressFill.classList.add('achievement-progress-fill');
  const percent = achievement.unlocked
    ? 100
    : Math.min(100, Math.round((progress / achievement.requirementAmount) * 100));
  progressFill.style.width = `${percent}%`;
  progressTrack.appendChild(progressFill);

  const progressLabel = document.createElement('p');
  progressLabel.classList.add('achievement-progress-label');
  progressLabel.textContent = achievement.unlocked
    ? 'Unlocked'
    : `${Math.min(progress, achievement.requirementAmount).toLocaleString()} / ${achievement.requirementAmount.toLocaleString()}`;

  li.appendChild(header);
  li.appendChild(description);
  li.appendChild(progressTrack);
  li.appendChild(progressLabel);

  return li;
};
