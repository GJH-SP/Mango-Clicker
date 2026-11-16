// vite.config.js
//
// Runs the frontend on its own dev server (http://localhost:5173), separate
// from the Express API (http://localhost:3000). No build step is required
// for this project — Vite is used purely as a dev server for the plain
// HTML/CSS/JS in src/frontend, serving native ES modules directly.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/frontend',
  server: {
    port: 5173,
  },
});
