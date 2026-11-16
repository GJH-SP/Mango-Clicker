// src/controllers/buildingsController.js
import { getAllBuildings } from '../models/buildings.js';

// GET ALL BUILDINGS (the shop catalog: name, cost, mps per building type)
export const getBuildingsController = async (req, res) => {
  try {
    const buildings = await getAllBuildings();
    return res.json(buildings);
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: err.message });
  }
};
