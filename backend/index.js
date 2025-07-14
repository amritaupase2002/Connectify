import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from './config/db.js'; 
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

// 🔐 Socket Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    console.error('Socket authentication error:', err);
    next(new Error('Authentication failed: Invalid token'));
  }
});

// 📁 Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Track active participants
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (User ID: ${socket.user?.id})`);

  socket.on('join_room', async (roomId) => {
    try {
      const [rooms] = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
      const room = rooms[0];
      if (!room) throw new Error('Room not found');

      socket.join(roomId);

      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      const [messages] = await db.query(
        `SELECT m.id, m.content, m.timestamp, u.id AS userId, u.username
         FROM messages m
         JOIN users u ON m.userId = u.id
         WHERE m.roomId = ?
         ORDER BY m.timestamp ASC
         LIMIT 100`,
        [roomId]
      );

      socket.emit('load_messages', messages);
      socket.to(roomId).emit('user_joined', socket.user.id);
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('room_error', error.message);
    }
  });

  socket.on('send_message', async ({ roomId, content }) => {
    try {
      if (!content?.trim()) {
        throw new Error('Message cannot be empty');
      }

      const [result] = await db.query(
        'INSERT INTO messages (content, roomId, userId) VALUES (?, ?, ?)',
        [content, roomId, socket.user.id]
      );
      const messageId = result.insertId;

      const [rows] = await db.query(
        `SELECT m.id, m.content, m.timestamp, u.id AS userId, u.username
         FROM messages m
         JOIN users u ON m.userId = u.id
         WHERE m.id = ?`,
        [messageId]
      );

      const message = rows[0];

      io.to(roomId).emit('receive_message', message);
    } catch (error) {
      console.error('Message send error:', error);
      socket.emit('message_error', error.message);
    }
  });

  // WebRTC signaling
  socket.on('offer', (targetSocketId, description) => {
    socket.to(targetSocketId).emit('offer', socket.id, description);
  });

  socket.on('answer', (targetSocketId, description) => {
    socket.to(targetSocketId).emit('answer', socket.id, description);
  });

  socket.on('candidate', (targetSocketId, candidate) => {
    socket.to(targetSocketId).emit('candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    activeRooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        socket.to(roomId).emit('user_left', socket.user.id);
        if (participants.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });
  });
});

// Test endpoint
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Public room join info
app.get('/api/join/:roomId', async (req, res) => {
  try {
    const [rooms] = await db.query(
      `SELECT r.*, u.id AS creatorId, u.username AS creatorUsername
       FROM rooms r
       LEFT JOIN users u ON r.createdBy = u.id
       WHERE r.id = ?`,
      [req.params.roomId]
    );

    const room = rooms[0];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      id: room.id,
      name: room.name,
      type: room.type,
      createdAt: room.createdAt,
      createdBy: {
        id: room.creatorId,
        username: room.creatorUsername
      }
    });
  } catch (error) {
    console.error('Join info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeRooms: activeRooms.size,
    activeConnections: io.engine.clientsCount
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(3001, () => {
  console.log(`Server running on port 3001`);
});
