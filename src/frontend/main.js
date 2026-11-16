/**
 * Mango Clicker — frontend game logic.
 *
 * This frontend runs on its own dev server (Vite, http://localhost:5173) and
 * talks to the Express API on a different origin (http://localhost:3000), so
 * every request is cross-origin — see API_BASE_URL below and the `cors()`
 * config in the backend's index.js.
 *
 * Auth: register/login return a JWT, which is stored in localStorage and sent
 * as `Authorization: Bearer <token>` on every request to a protected route
 * (harvest, tick, buy-building, state, achievements, update, delete). See
 * `authorizedFetch()` — it attaches the header automatically and, if the
 * server ever responds 401 (missing/expired token), logs the player out and
 * sends them back to the login screen.
 *
 * Pricing note: building costs scale with how many of that specific
 * building the player owns; the manual-click amount scales with MPS plus
 * any achievement click bonus. That math lives entirely on the server
 * (src/utils/gameBalance.js) — GET /api/game/:id/state returns a
 * ready-to-render `shop` array and a `clickAmount`, so this file never has
 * to duplicate the formulas.
 *
 * Core Mechanic 2 (Achievements): the achievements catalog + this user's
 * progress is loaded once via GET /api/game/:id/achievements. From then on,
 * "unlocked" status is patched in locally whenever a harvest/tick/buy
 * response includes newly-unlocked achievements (see
 * `applyUnlockedAchievements`) — no extra requests needed. Progress bars for
 * still-locked achievements are computed client-side from data we already
 * have (currentUser.lifetimeMangoes / shopItems[].owned), which is exactly
 * the same data the server itself used to decide unlocks.
 */

import { createBuildingCard } from './components/building-card.js';
import { createAchievementCard } from './components/achievement-card.js';

const API_BASE_URL = 'http://localhost:3000';
const USERS_URL = `${API_BASE_URL}/api/users`;
const GAME_URL = `${API_BASE_URL}/api/game`;

const TOKEN_KEY = 'mangoClicker.token';
const USER_ID_KEY = 'mangoClicker.userId';
const TICK_INTERVAL_MS = 1000;

// ---------- Game state (in memory) ----------
let currentUser = null; // { userId, username, currentMangoes, lifetimeMangoes, mps, bonusClicks }
let shopItems = []; // [{ buildingId, name, baseMps, currentCost, owned }]
let achievements = []; // [{ achievementId, name, description, requirementType, requirementBuildingId, requirementAmount, rewardType, rewardAmount, unlocked, unlockedAt }]
let clickAmount = 1; // mangoes earned per manual click, from the server
let tickIntervalId = null;

// ---------- DOM references ----------
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');

const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');

const usernameView = document.getElementById('username-view');
const usernameDisplay = document.getElementById('username-display');
const editUsernameBtn = document.getElementById('edit-username-btn');
const usernameEditForm = document.getElementById('username-edit-form');
const usernameEditInput = document.getElementById('username-edit-input');
const usernameEditCancel = document.getElementById('username-edit-cancel');
const usernameEditError = document.getElementById('username-edit-error');
const logoutBtn = document.getElementById('logout-btn');

const currentMangoesEl = document.getElementById('current-mangoes');
const mpsValueEl = document.getElementById('mps-value');
const lifetimeMangoesEl = document.getElementById('lifetime-mangoes');

const mangoBtn = document.getElementById('mango-btn');
const clickHintEl = document.getElementById('click-hint');
const floatersEl = document.getElementById('floaters');
const gameError = document.getElementById('game-error');

const panelTabs = document.querySelectorAll('.panel-tab');
const buildingListEl = document.getElementById('building-list');
const achievementListEl = document.getElementById('achievement-list');
const toastsEl = document.getElementById('achievement-toasts');

// ==================== Token helpers ====================

const getToken = () => localStorage.getItem(TOKEN_KEY);

const saveSession = (token, userId) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, String(userId));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
};

/**
 * fetch() wrapper for protected routes: attaches the JWT, and if the server
 * ever responds 401 (missing/expired/invalid token) it logs the player out
 * and throws, so callers don't have to handle that case individually.
 */
const authorizedFetch = async (url, options = {}) => {
  const token = getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    showAuthScreen();
    showAuthError('Your session expired. Please log in again.');
    throw new Error('Session expired');
  }

  return response;
};

// ==================== API helpers ====================

/**
 * Register a new player. The server hashes the password with bcrypt and
 * logs the new player straight in.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, user: Object}>}
 */
const registerUser = async (username, password) => {
  const response = await fetch(USERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to register');
  }
  return data;
};

/**
 * Log an existing player in.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, user: Object}>}
 */
const loginUser = async (username, password) => {
  const response = await fetch(`${USERS_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to log in');
  }
  return data;
};

/**
 * Update the logged-in user's own account (e.g. their username).
 * Protected route — requires the JWT to match :id.
 * @param {number|string} userId
 * @param {Object} updates - Fields to update, e.g. { username: 'newName' }
 * @returns {Promise<Object>} The updated user (no password field).
 */
const updateProfile = async (userId, updates) => {
  const response = await authorizedFetch(`${USERS_URL}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data;
};

/**
 * Fetch the full game state: user stats, owned buildings, the priced shop
 * list, and the player's current click amount. Protected route.
 * @param {number|string} userId
 * @returns {Promise<{user: Object, buildings: Array, shop: Array, clickAmount: number}>}
 */
const fetchGameState = async (userId) => {
  const response = await authorizedFetch(`${GAME_URL}/${userId}/state`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load game state');
  }
  return data;
};

/**
 * Fetch this user's achievement catalog + unlocked status + progress.
 * Protected route (Core Mechanic 2).
 * @param {number|string} userId
 * @returns {Promise<{achievements: Array}>}
 */
const fetchAchievements = async (userId) => {
  const response = await authorizedFetch(`${GAME_URL}/${userId}/achievements`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load achievements');
  }
  return data;
};

/**
 * Harvest one manual click's worth of mangoes. The amount is decided by the
 * server (it scales with MPS and click-bonus achievements) — the client
 * doesn't send an amount. Protected route.
 * @param {number|string} userId
 * @returns {Promise<Object>}
 */
const harvestMango = async (userId) => {
  const response = await authorizedFetch(`${GAME_URL}/${userId}/harvest`, {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to harvest');
  }
  return data;
};

/**
 * Auto-generate mangoes based on the player's current MPS.
 * Called once per second while the game screen is open. Protected route.
 * @param {number|string} userId
 * @returns {Promise<Object>}
 */
const tickGame = async (userId) => {
  const response = await authorizedFetch(`${GAME_URL}/${userId}/tick`, {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to tick');
  }
  return data;
};

/**
 * Buy one unit of a building, at its current owned-quantity-scaled price.
 * Protected route.
 * @param {number|string} userId
 * @param {string} buildingId
 * @returns {Promise<Object>}
 */
const buyBuilding = async (userId, buildingId) => {
  const response = await authorizedFetch(`${GAME_URL}/${userId}/buy-building`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buildingId, quantity: 1 }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to buy building');
  }
  return data;
};

// ==================== Rendering ====================

/** Format a number with thousands separators, rounded down to a whole mango. */
const formatMangoes = (value) => Math.floor(value).toLocaleString();

/** Update the stats bar (current mangoes, MPS, lifetime mangoes) and click hint. */
const renderStats = () => {
  currentMangoesEl.textContent = formatMangoes(currentUser.currentMangoes);
  mpsValueEl.textContent = formatMangoes(currentUser.mps);
  lifetimeMangoesEl.textContent = formatMangoes(currentUser.lifetimeMangoes);
  clickHintEl.textContent = `Click the mango to harvest +${formatMangoes(clickAmount)}!`;
};

/** Rebuild the shop list from the latest priced `shopItems`. */
const renderShop = () => {
  buildingListEl.innerHTML = '';

  shopItems.forEach((shopItem) => {
    const card = createBuildingCard(shopItem, currentUser.currentMangoes, {
      onBuy: handleBuy,
    });
    buildingListEl.appendChild(card);
  });
};

/**
 * How far the player currently is toward one achievement's requirement.
 * Computed from data we already have client-side — the same underlying
 * numbers the server used to decide unlocks.
 */
const getAchievementProgress = (achievement) => {
  if (achievement.requirementType === 'building_owned') {
    const item = shopItems.find((s) => s.buildingId === achievement.requirementBuildingId);
    return item ? item.owned : 0;
  }
  return currentUser.lifetimeMangoes;
};

/** Rebuild the achievements list with live progress bars. */
const renderAchievements = () => {
  achievementListEl.innerHTML = '';

  achievements.forEach((achievement) => {
    const progress = getAchievementProgress(achievement);
    const card = createAchievementCard(achievement, progress);
    achievementListEl.appendChild(card);
  });
};

/** Spawn a floating "+N" label above the mango button. */
const spawnFloater = (amount) => {
  const floater = document.createElement('span');
  floater.classList.add('floater');
  floater.textContent = `+${formatMangoes(amount)}`;

  const offsetX = Math.round((Math.random() - 0.5) * 60);
  floater.style.left = `calc(50% + ${offsetX}px)`;
  floater.style.top = '30%';

  floatersEl.appendChild(floater);
  setTimeout(() => floater.remove(), 900);
};

/** Show a toast celebrating a newly-unlocked achievement. */
const spawnAchievementToast = (achievement) => {
  const toast = document.createElement('div');
  toast.classList.add('achievement-toast');
  toast.innerHTML = `
    <span class="achievement-toast-icon">🏆</span>
    <span>
      <span class="achievement-toast-title">Achievement unlocked</span><br>
      <span class="achievement-toast-name"></span>
    </span>
  `;
  toast.querySelector('.achievement-toast-name').textContent = achievement.name;

  toastsEl.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
};

/** Briefly show an error message under the game panels. */
let gameErrorTimeoutId = null;
const showGameError = (message) => {
  gameError.textContent = message;
  gameError.classList.remove('hidden');
  clearTimeout(gameErrorTimeoutId);
  gameErrorTimeoutId = setTimeout(() => gameError.classList.add('hidden'), 3000);
};

const showAuthError = (message) => {
  authError.textContent = message;
  authError.classList.remove('hidden');
};

const clearAuthError = () => {
  authError.textContent = '';
  authError.classList.add('hidden');
};

// ==================== Game actions ====================

/**
 * Mark newly-unlocked achievements as unlocked in local state and pop a
 * toast for each — called after harvest/tick/buy, whose responses include
 * an `unlockedAchievements` array (empty most of the time).
 */
const applyUnlockedAchievements = (unlockedList) => {
  if (!unlockedList || unlockedList.length === 0) {
    return;
  }

  const unlockedIds = new Set(unlockedList.map((a) => a.achievementId));
  achievements = achievements.map((achievement) =>
    unlockedIds.has(achievement.achievementId)
      ? { ...achievement, unlocked: true }
      : achievement
  );

  unlockedList.forEach(spawnAchievementToast);
  renderAchievements();
};

/**
 * Pull a fresh copy of the game state from the server and re-render.
 * Used after buying a building, since owning more changes every future
 * price for that building type.
 */
const refreshState = async () => {
  const state = await fetchGameState(currentUser.userId);
  currentUser = state.user;
  shopItems = state.shop;
  clickAmount = state.clickAmount;
  renderStats();
  renderShop();
  renderAchievements(); // building-owned progress may have changed
};

/** Handle a mango-button click: harvest and animate it. */
const handleHarvestClick = async () => {
  mangoBtn.classList.add('squish');
  setTimeout(() => mangoBtn.classList.remove('squish'), 120);

  try {
    const result = await harvestMango(currentUser.userId);
    spawnFloater(result.amountHarvested);
    currentUser.currentMangoes = result.currentMangoes;
    currentUser.lifetimeMangoes = result.lifetimeMangoes;
    currentUser.mps = result.mps;
    currentUser.bonusClicks = result.bonusClicks;
    clickAmount = result.clickAmount;
    renderStats();
    renderShop(); // affordability may have changed
    applyUnlockedAchievements(result.unlockedAchievements);
  } catch (error) {
    showGameError(error.message);
  }
};

/** Handle a Buy button click for a given building. */
const handleBuy = async (buildingId) => {
  try {
    const result = await buyBuilding(currentUser.userId, buildingId);
    // Owning more of this building changes its future price — refetch the
    // full priced state rather than patch it locally.
    await refreshState();
    applyUnlockedAchievements(result.unlockedAchievements);
  } catch (error) {
    showGameError(error.message);
  }
};

/** Auto-generate mangoes once per second based on the player's MPS. */
const runTick = async () => {
  try {
    const result = await tickGame(currentUser.userId);
    currentUser.currentMangoes = result.currentMangoes;
    currentUser.lifetimeMangoes = result.lifetimeMangoes;
    currentUser.mps = result.mps;
    currentUser.bonusClicks = result.bonusClicks;
    clickAmount = result.clickAmount;
    renderStats();
    renderShop();
    applyUnlockedAchievements(result.unlockedAchievements);
  } catch (error) {
    // authorizedFetch already handles the 401/session-expired case by
    // logging out — anything else, just log it rather than spamming the UI.
    console.error('Tick failed:', error.message);
  }
};

// ==================== Username editing ====================

const enterUsernameEditMode = () => {
  usernameEditInput.value = currentUser.username;
  usernameEditError.classList.add('hidden');
  usernameView.classList.add('hidden');
  usernameEditForm.classList.remove('hidden');
  usernameEditInput.focus();
  usernameEditInput.select();
};

const exitUsernameEditMode = () => {
  usernameEditForm.classList.add('hidden');
  usernameView.classList.remove('hidden');
};

const handleUsernameEditSubmit = async (event) => {
  event.preventDefault();
  const newUsername = usernameEditInput.value.trim();
  usernameEditError.classList.add('hidden');

  if (!newUsername || newUsername === currentUser.username) {
    exitUsernameEditMode();
    return;
  }

  try {
    const updated = await updateProfile(currentUser.userId, { username: newUsername });
    currentUser.username = updated.username;
    usernameDisplay.textContent = currentUser.username;
    exitUsernameEditMode();
  } catch (error) {
    usernameEditError.textContent = error.message;
    usernameEditError.classList.remove('hidden');
  }
};

// ==================== Shop / Achievements tab switching ====================

panelTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    panelTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    if (tab.dataset.panel === 'shop') {
      buildingListEl.classList.remove('hidden');
      achievementListEl.classList.add('hidden');
    } else {
      achievementListEl.classList.remove('hidden');
      buildingListEl.classList.add('hidden');
    }
  });
});

// ==================== Screen transitions ====================

/** Load a player's full state + achievements, show the game screen, and start ticking. */
const startGame = async (userId) => {
  const [state, achievementsData] = await Promise.all([
    fetchGameState(userId),
    fetchAchievements(userId),
  ]);

  currentUser = state.user;
  shopItems = state.shop;
  clickAmount = state.clickAmount;
  achievements = achievementsData.achievements;

  localStorage.setItem(USER_ID_KEY, String(currentUser.userId));

  usernameDisplay.textContent = currentUser.username;
  authScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  renderStats();
  renderShop();
  renderAchievements();

  clearInterval(tickIntervalId);
  tickIntervalId = setInterval(runTick, TICK_INTERVAL_MS);
};

/** Return to the login screen and stop ticking. */
const showAuthScreen = () => {
  clearInterval(tickIntervalId);
  tickIntervalId = null;
  currentUser = null;
  shopItems = [];
  achievements = [];

  clearSession();

  gameScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  loginForm.reset();
  registerForm.reset();
};

// ==================== Event listeners ====================

// Auth tab switching
authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    authTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    clearAuthError();

    if (tab.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  });
});

// Login form submit
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthError();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const { token, user } = await loginUser(username, password);
    saveSession(token, user.userId);
    await startGame(user.userId);
  } catch (error) {
    showAuthError(error.message);
  }
});

// Register form submit
registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthError();

  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  try {
    const { token, user } = await registerUser(username, password);
    saveSession(token, user.userId);
    await startGame(user.userId);
  } catch (error) {
    showAuthError(error.message);
  }
});

// Harvest click
mangoBtn.addEventListener('click', handleHarvestClick);

// Username editing
editUsernameBtn.addEventListener('click', enterUsernameEditMode);
usernameEditCancel.addEventListener('click', exitUsernameEditMode);
usernameEditForm.addEventListener('submit', handleUsernameEditSubmit);

// Logout
logoutBtn.addEventListener('click', showAuthScreen);

// ==================== Startup ====================

document.addEventListener('DOMContentLoaded', async () => {
  const savedUserId = localStorage.getItem(USER_ID_KEY);
  const savedToken = getToken();

  if (!savedUserId || !savedToken) {
    return;
  }

  try {
    await startGame(savedUserId);
  } catch (error) {
    // Saved session is no longer valid (expired token, deleted user, etc.)
    // — authorizedFetch already returns to the login screen in the 401
    // case; this just makes sure stale storage doesn't linger otherwise.
    clearSession();
  }
});
