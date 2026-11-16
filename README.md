# Mango Clicker
01) Game Description:
Mango Clicker is an incremental farming game where players harvest mangoes and purchase buildings to increase their mango production rate. Each user begins with zero mangoes and progresses by harvesting manually or buying automated buildings such as Mango Trees, Orchard Workers, and Mango Factories. As players upgrade their mango empire, their Mangoes‑Per‑Second (MPS) increases, allowing faster progression and unlocking higher‑tier buildings (**Core Mechanic 1**). Alongside that, players unlock **Achievements** for hitting milestones — harvesting your first mango, reaching lifetime-mango totals, or owning enough of a given building — and each achievement permanently boosts either MPS or the player's per-click yield (**Core Mechanic 2**). The two mechanics feed into each other: progress in harvesting/building unlocks achievements, and achievements make harvesting/building faster. The backend implements all core game logic (harvesting, buying buildings, MPS auto-generation, achievement tracking, and user statistics), and a plain HTML/CSS/JS frontend in `src/frontend/` provides a Cookie‑Clicker‑style UI: register/login, a clickable mango, live stats, a building shop, and an achievements panel, all wired up to the API below.



02) The infrastructure endpoints (GET /api/health, GET /api-docs) remain unchanged, and the Mango Clicker game feature is implemented following the required MVC structure:

Tables in src/db/schema.js

Seed data in src/db/seed.js

Models in src/models/

Controllers in src/controllers/

Routes in src/routes/

Route registration in index.js

The game feature is fully functional and demonstrates CRUD operations, dynamic routes, query parameters, and server–database interaction using Drizzle ORM.


03) Setup

Before the first run, create your own `.env` from the template (it is gitignored and must never be committed):

```bash
cp .env.example .env
# then set JWT_SECRET to a long random string, e.g.:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API server and the frontend now run as two separate processes on two
different ports — run each in its own terminal:

```bash
npm install
npm run db
```

Terminal 1 — API server (http://localhost:3000):
```bash
npm run dev
```

Terminal 2 — frontend dev server (http://localhost:5173):
```bash
npm run dev:client
```

Open **http://localhost:5173** in your browser

Before running either, copy your JWT secret into `.env` (a placeholder is
already there for local dev — see section 07, Authentication Flow).

> `bcrypt` is a native module and compiles a small C++ addon during
> `npm install`. If that install fails on your machine (common on Windows
> without build tools installed), install the build tools it asks for, or
> swap `bcrypt` for `bcryptjs` in `package.json` and in the `import` at the
> top of `src/controllers/usersController.js` — same `hash()`/`compare()`
> API, pure JavaScript, no compilation needed.


04) API Endpoints:

🔒 = protected — requires `Authorization: Bearer <token>`, and the token must belong to the same user as `:id` (a 403 is returned otherwise).

## Users:
GET	/api/users	Get all users (public, passwords never included in responses)
GET	/api/users/:id	Get user by ID (public)
GET	/api/users?minMangoes=100	Query users by mango count (public)
POST	/api/users	Register — hashes the password with bcrypt, returns `{ token, user }`
POST	/api/users/login	Log in with `{ username, password }`, returns `{ token, user }`
PUT	/api/users/:id	🔒 Update user info (e.g. username)
DELETE	/api/users/:id	🔒 Delete a user


## Game:
POST	/api/game/:id/harvest	🔒 Harvest mangoes manually (amount is computed server-side from the player's MPS + click-bonus achievements — no body needed)
POST	/api/game/:id/tick	🔒 Auto-generate mangoes based on the user's MPS (called once per second by the frontend)
POST	/api/game/:id/buy-building	🔒 Buy a building at its current owned-quantity-scaled price (body: { buildingId, quantity })
GET	/api/game/:id/state	🔒 Get full user game state (user stats, owned buildings, priced shop list, current click amount)

`harvest`, `tick`, and `buy-building` all also return an `unlockedAchievements` array (empty most of the time) — see the Achievements endpoints below.

## Buildings:
GET	/api/buildings	Get the shop catalog (public — all building types, costs, and MPS values)

## Achievements (Core Mechanic 2):
GET	/api/achievements	Get the achievement catalog (public — every achievement's requirement and reward)
GET	/api/game/:id/achievements	🔒 Get this user's achievement progress (catalog annotated with unlocked/locked + progress toward each requirement)



05) Database Schema
written in column:type:notes format


## User
user_id:integer:PK, auto-increment
username:varchar:unique
password:varchar:bcrypt hash (never plaintext, never returned in any API response)
current_mangoes:int:spendable mangoes
lifetime_mangoes:int:total mangoes ever earned
mps:int:mangoes per second (raised directly by buying buildings AND by unlocked mps_bonus achievements)
bonus_clicks:int:permanent flat bonus to every manual click, granted by unlocked click_bonus achievements


## Buildings
building_id:varchar:PK
name:varchar
base_cost:int
base_mps:int


## User Buildings
user_building_id:varchar:PK
user_id:integer:FK -> users.user_id
building_id:varchar:FK -> buildings.building_id
quantity:int


## Achievements
achievement_id:varchar:PK
name:varchar
description:varchar
requirement_type:varchar:'lifetime_mangoes' or 'building_owned'
requirement_building_id:varchar:FK -> buildings.building_id, nullable (only set when requirement_type is 'building_owned')
requirement_amount:int:threshold to unlock
reward_type:varchar:'mps_bonus' or 'click_bonus'
reward_amount:int:how much mps or bonus_clicks is granted on unlock


## User Achievements
user_achievement_id:varchar:PK
user_id:integer:FK -> users.user_id
achievement_id:varchar:FK -> achievements.achievement_id
unlocked_at:varchar:ISO timestamp — presence of a row here is what "unlocked" means



06) Assumptions
Auto-generation of mangoes per second (MPS ticking) is implemented via a dedicated `POST /api/game/:id/tick` endpoint. The frontend calls it once per second while the game screen is open and adds the user's current MPS to their mango totals; this is a simplified, client-driven tick rather than server-side offline-progress calculation (i.e. mangoes only accumulate while the page is open and polling).
The manual-click amount scales with the player's current MPS, plus any permanent `bonus_clicks` granted by unlocked achievements (see `calculateClickAmount` in `src/utils/gameBalance.js`).
Building prices scale with how many of that *specific* building type the player already owns (the classic Cookie Clicker curve: `price = baseCost * 1.15^ownedQuantity`), independently of MPS and independently of every other building. Owning 0 of a building always costs exactly its `base_cost` (1.15^0 = 1) — e.g. the first Orchard Worker is always 100 mangoes; the price only climbs from the second one onward. See `calculateBuildingCost` in `src/utils/gameBalance.js` and section 10 below.
This is all applied entirely on the server — the client never decides prices or click amounts, it just displays what the server returns in `GET /api/game/:id/state`.
Achievements (Core Mechanic 2) are checked server-side, right after `harvest`, `tick`, or `buy-building` changes the user's state (see `checkAndUnlockAchievements` in `src/controllers/achievementsController.js`) — there's no separate polling endpoint. Each achievement can only unlock once (enforced by inserting a row into `user_achievements`, one per user per achievement); its reward is applied immediately and permanently to `mps` or `bonus_clicks` and is never removed.


07) Authentication Flow
- **JWT session management** — `POST /api/users/login` and `POST /api/users` (register) both return `{ token, user }`. The frontend stores the token in `localStorage` and sends it as `Authorization: Bearer <token>` on every request to a protected route (see the 🔒 endpoints in section 04). Tokens expire after `JWT_EXPIRES_IN` (default `2h`, set in `.env`); an expired/missing token gets a `401`, which the frontend catches and uses to log the player out automatically (see `authorizedFetch()` in `src/frontend/main.js`).
- **Bcrypt password hashing** — passwords are hashed with `bcrypt.hash()` before being stored (`createUserController`) and checked with `bcrypt.compare()` on login (`loginUserController`), both in `src/controllers/usersController.js`. Passwords are never stored in plaintext and never included in any API response (every controller strips the `password` field before sending a user object back).
- **Auth middleware** — `src/middlewares/auth.js` exports two reusable functions:
  - `authenticateToken` — verifies the JWT and attaches `{ userId, username }` to `req.user`. Responds `401 Unauthorized` if the token is missing or invalid.
  - `authorizeOwner` — checks that `req.user.userId` matches the `:id` in the URL. Responds `403 Forbidden` if a valid token is used to try to access another user's account or game state.
  These are applied in `src/routes/usersRouter.js` and `src/routes/gameRouter.js` to every route that requires a logged-in user (see the 🔒 markers in section 04).
- **Page protection** — the frontend never renders the game screen without a valid token + user id in `localStorage`; on load it attempts to restore the session via `GET /api/game/:id/state`, and if that fails (e.g. expired token) it falls back to the login screen.


08) Adding a new building type
Buildings are entirely data-driven — every part of the stack (schema, models, controllers, routes, and the frontend shop) already loops over whatever rows exist in the `buildings` table. To add a new one:

1. Open `src/db/seed.js` and add a new object to the `sampleBuildings` array, e.g.:
   ```js
   {
     buildingId: "mango_refinery",
     name: "Mango Refinery",
     baseCost: 10000,
     baseMps: 120
   }
   ```
   - `buildingId` must be unique (it's the primary key).
   - As a rough balancing guide, each new tier is usually ~10x the previous tier's `baseCost` and roughly proportional in `baseMps` (look at the existing Mango Tree → Orchard Worker → Mango Factory progression for reference).
2. Run `npm run db` to reset and reseed the database with the new building included. (This wipes existing data, same as any other seed change — it's a full reset, not a migration.)
3. That's it. No controller, route, or frontend changes are needed:
   - `GET /api/buildings` and the `shop` array in `GET /api/game/:id/state` automatically include the new row.
   - `POST /api/game/:id/buy-building` already works for any `buildingId` that exists in the table.
   - The frontend shop list re-renders from whatever `shop` array the server returns, so the new building just appears.

If you want it to visually stand out (e.g. a distinct icon), that's the only manual step left — it's a small frontend tweak in `src/frontend/components/building-card.js`.


09) Adding a new achievement
Same pattern as buildings — achievements are data-driven too. To add one:

1. Open `src/db/seed.js` and add a new object to the `sampleAchievements` array, e.g.:
   ```js
   {
     achievementId: "tree_farmer",
     name: "Tree Farmer",
     description: "Own 25 Mango Trees.",
     requirementType: "building_owned",
     requirementBuildingId: "mango_tree",
     requirementAmount: 25,
     rewardType: "mps_bonus",
     rewardAmount: 15
   }
   ```
   - `achievementId` must be unique (it's the primary key).
   - `requirementType` is either `"lifetime_mangoes"` (checked against the user's total lifetime mangoes) or `"building_owned"` (checked against how many of `requirementBuildingId` the user owns — leave `requirementBuildingId: null` for the `lifetime_mangoes` type).
   - `rewardType` is either `"mps_bonus"` (adds `rewardAmount` straight to the user's `mps`) or `"click_bonus"` (adds `rewardAmount` to the user's `bonus_clicks`).
2. Run `npm run db` to reset and reseed the database with the new achievement included.
3. That's it — no controller, route, or frontend changes needed. `GET /api/achievements`, `GET /api/game/:id/achievements`, and the achievements panel in the frontend all read straight from the `achievements` table, and `checkAndUnlockAchievements()` in `src/controllers/achievementsController.js` already loops over every row in the catalog.


10) Tuning the difficulty curve
`src/utils/gameBalance.js` has three constants:
- `CLICK_BASE_AMOUNT` — mangoes per click at 0 MPS.
- `CLICK_MPS_BONUS_RATE` — extra mangoes per click for every point of MPS.
- `BUILDING_COST_GROWTH_RATE` — how much each unit owned multiplies that building's next price by (default `1.15`, the classic Cookie Clicker curve). Higher = prices climb faster the more you own; `1` would make prices flat forever.

`calculateBuildingCost(baseCost, ownedQuantity)` is the single function controlling per-building pricing — it's called from both `buyBuildingController` (to charge the right amount) and `getUserStateController` (to display the right price in the shop), so there's only one place to change the formula.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the API server (plain `node`, no auto-reload) |
| `npm run dev` | Start the API server with auto-reload (http://localhost:3000) |
| `npm run dev:client` | Start the frontend dev server (http://localhost:5173) |
| `npm run db` | Recreate DB and seed data |
| `npm test` | Run test suite |
| `npm run export` | Export project zip (without node_modules) |
