import { Router } from 'express';
import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken'; // Fixed import (previously had 'sign')
import User from '../models/User.js';

const router = Router();

// Original working version
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      'your_jwt_secret', // Keep this consistent with your other middleware
      { expiresIn: '1h' }
    );
    
    res.json({ 
      token,
      user: { id: user.id, username: user.username } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;