import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import sequelize from './config/db.js';
import User from './models/User.js';
import Room from './models/Room.js';
import Message from './models/Message.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

// Enhanced CORS configuration
app.use(cors());

app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  },

  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Authentication middleware for Socket.IO
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Track active participants
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (User ID: ${socket.user?.id})`);

  // Join room with authentication
  socket.on('join_room', async (roomId) => {
    try {
      const room = await Room.findByPk(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      socket.join(roomId);
      
      // Track participants
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      // Load messages
      const messages = await Message.findAll({
        where: { roomId },
        include: [{ model: User, attributes: ['id', 'username'] }],
        order: [['timestamp', 'ASC']],
        limit: 100 // Prevent loading too many messages
      });

      socket.emit('load_messages', messages);
      socket.to(roomId).emit('user_joined', socket.user.id);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('room_error', error.message);
    }
  });

  // Handle messages
  socket.on('send_message', async ({ roomId, content }) => {
    try {
      if (!content?.trim()) {
        throw new Error('Message cannot be empty');
      }

      const message = await Message.create({
        content,
        roomId,
        userId: socket.user.id
      });

      const messageWithUser = await Message.findOne({
        where: { id: message.id },
        include: [{ model: User, attributes: ['id', 'username'] }],
      });

      io.to(roomId).emit('receive_message', {
        id: message.id,
        content: message.content,
        userId: messageWithUser.User.id,
        username: messageWithUser.User.username,
        timestamp: message.timestamp
      });

    } catch (error) {
      console.error('Message send error:', error);
      socket.emit('message_error', error.message);
    }
  });

  // WebRTC Signaling
  socket.on('offer', (targetSocketId, description) => {
    socket.to(targetSocketId).emit('offer', socket.id, description);
  });

  socket.on('answer', (targetSocketId, description) => {
    socket.to(targetSocketId).emit('answer', socket.id, description);
  });

  socket.on('candidate', (targetSocketId, candidate) => {
    socket.to(targetSocketId).emit('candidate', socket.id, candidate);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up room participation
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
app.get('/', (req, res) => {
  res.send('Hello, World!');
})

app.get('/api/join/:roomId', async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.roomId, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      id: room.id,
      name: room.name,
      type: room.type,
      createdAt: room.createdAt,
      createdBy: room.User
    });
  } catch (error) {
    console.error('Meeting link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeRooms: activeRooms.size,
    activeConnections: io.engine.clientsCount
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Database synchronization and server start
sequelize.sync({ alter: true }).then(() => {
  server.listen(3001, () => {
    console.log(`
      Server running on port 3001
      Database: ${sequelize.config.database}
      CORS Allowed Origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}
    `);
  });
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});