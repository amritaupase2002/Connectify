import { Router } from 'express';
import Room from '../models/Room.js';
import auth from '../middleware/auth.js';

const router = Router();

router.post('/create', auth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const room = await Room.create({
      name: name.trim(),
      type: 'video',
      createdBy: req.user.id // Track creator
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Room creation error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Room name already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keep existing routes
router.get('/list', auth, async (req, res) => {
  try {
    const rooms = await Room.findAll();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;