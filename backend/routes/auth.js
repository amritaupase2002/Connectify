import { Router } from 'express';
import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = Router();

// 🔐 Register Route
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if username already exists
    const [existing] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password and insert user
    const hashedPassword = await hash(password, 10);
    await db.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔓 Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      'your_jwt_secret', // Replace with process.env.JWT_SECRET in production
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
