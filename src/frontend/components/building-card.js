/**
 * Building Card Component
 *
 * Renders one row in the Orchard Shop: the building's name, its MPS bonus,
 * how many the player already owns, and a Buy button showing its current
 * price. Prices scale with the player's MPS (calculated server-side), so
 * this component just displays whatever `currentCost` it's given — it does
 * not do any pricing math itself. The Buy button is disabled when the
 * player can't afford it.
 *
 * Usage:
 *   import { createBuildingCard } from './components/building-card.js';
 *
 *   const li = createBuildingCard(shopItem, currentMangoes, {
 *     onBuy: (buildingId) => { ... },
 *   });
 *   document.getElementById('building-list').appendChild(li);
 */

/**
 * Create a list item element for a single shop building.
 *
 * @param {Object} shopItem - One entry from the `shop` array returned by
 *   `GET /api/game/:id/state`.
 * @param {string} shopItem.buildingId - The building's ID.
 * @param {string} shopItem.name - Display name (e.g. "Mango Tree").
 * @param {number} shopItem.baseMps - MPS gained per unit owned.
 * @param {number} shopItem.currentCost - What one unit costs right now (scales with MPS).
 * @param {number} shopItem.owned - How many of this building the player already owns.
 * @param {number} currentMangoes - The player's current spendable mangoes.
 * @param {Object} callbacks - Event handler callbacks.
 * @param {Function} callbacks.onBuy - Called with (buildingId) when Buy is clicked.
 * @returns {HTMLLIElement} The constructed list item element.
 */
export const createBuildingCard = (shopItem, currentMangoes, { onBuy }) => {
  const li = document.createElement('li');
  li.classList.add('building-card');

  const canAfford = currentMangoes >= shopItem.currentCost;
  if (canAfford) {
    li.classList.add('affordable');
  }

  // Left side: name + stats
  const info = document.createElement('div');
  info.classList.add('building-info');

  const title = document.createElement('h3');
  title.textContent = shopItem.name;

  const meta = document.createElement('p');
  meta.classList.add('building-meta');
  meta.textContent = `+${shopItem.baseMps} MPS each · Owned: `;

  const ownedSpan = document.createElement('span');
  ownedSpan.classList.add('building-owned');
  ownedSpan.textContent = shopItem.owned;
  meta.appendChild(ownedSpan);

  info.appendChild(title);
  info.appendChild(meta);

  // Right side: buy button — shows the live, MPS-scaled price
  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.classList.add('buy-btn');
  buyBtn.textContent = `🥭 ${shopItem.currentCost.toLocaleString()}`;
  buyBtn.disabled = !canAfford;
  buyBtn.dataset.buildingId = shopItem.buildingId;
  buyBtn.addEventListener('click', () => {
    onBuy(shopItem.buildingId);
  });

  li.appendChild(info);
  li.appendChild(buyBtn);

  return li;
};
