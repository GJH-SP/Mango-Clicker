// src/middlewares/auth.js
//
// Reusable auth middleware for protecting routes.
//   - authenticateToken: verifies the JWT sent in the Authorization header.
//   - authorizeOwner: makes sure the logged-in user matches the :id in the URL,
//     so user A can't harvest/buy/update/delete on behalf of user B.
//
// Apply them to any route that requires a logged-in user, e.g.:
//   router.post('/:id/harvest', authenticateToken, authorizeOwner, harvestController);

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing/verifying tokens
  // with "undefined" as the secret.
  throw new Error('JWT_SECRET is not set. Add it to your .env file.');
}

/**
 * Verifies the "Authorization: Bearer <token>" header on the request.
 * On success, attaches the decoded payload ({ userId, username }) to req.user.
 * On failure, responds 401 and does not call next().
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, username, iat, exp }
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Must run AFTER authenticateToken. Ensures the logged-in user (req.user)
 * matches the :id route param, so a valid token for one user can't be used
 * to act on another user's account or game state.
 */
export const authorizeOwner = (req, res, next) => {
  const routeUserId = Number(req.params.id);

  if (!req.user || req.user.userId !== routeUserId) {
    return res.status(403).json({ error: 'You do not have permission to access this resource' });
  }

  return next();
};
