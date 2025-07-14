import { Router } from 'express';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// 🔧 Create Room
router.post('/create', auth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    // Check if room name already exists
    const [existing] = await db.query('SELECT * FROM rooms WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Room name already exists' });
    }

    // Insert new room
    const [result] = await db.query(
      'INSERT INTO rooms (name, type, createdBy) VALUES (?, ?, ?)',
      [name.trim(), 'video', req.user.id]
    );

    // Fetch the newly created room
    const [room] = await db.query('SELECT * FROM rooms WHERE id = ?', [result.insertId]);
    res.status(201).json(room[0]);
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 📃 List Rooms
router.get('/list', auth, async (req, res) => {
  try {
    const [rooms] = await db.query('SELECT * FROM rooms');
    res.json(rooms);
  } catch (error) {
    console.error('Room listing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
