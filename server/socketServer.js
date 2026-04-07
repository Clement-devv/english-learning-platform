// server/socketServer.js - WITH PDF VISIBILITY CONTROL
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config/config.js';

export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 10e6 // 10MB for PDF uploads
  });

  // ── JWT authentication for every socket connection ───────────────────────
  // Client must pass the auth token in handshake: io(URL, { auth: { token } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId   = decoded.id;
      socket.userRole = decoded.role;     // role from JWT — not trusted from client
      socket.centerId = decoded.centerId; // center slug the token was issued for
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Scope a channel name to the authenticated center so rooms are always
  // isolated even if two centers use the same booking ObjectId.
  const tenantRoom = (socket, channelName) => `${socket.centerId}::${channelName}`;

  // Store active whiteboard sessions keyed by tenant-scoped room name.
  const whiteboardSessions = new Map();

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id, `(${socket.centerId})`);

    // Join whiteboard room
    socket.on('join-whiteboard', ({ channelName, userName }) => {
      try {
        const room = tenantRoom(socket, channelName);
        socket.join(room);
        socket.userName    = userName;
        socket.channelName = channelName; // original name kept for client-facing log messages
        socket.roomName    = room;        // scoped name used for all room operations

        if (!whiteboardSessions.has(room)) {
          whiteboardSessions.set(room, {
            users: new Set(),
            locked: true,
            pdfData: null,
            pdfVisibleToStudents: false,
            currentPage: 1,
          });
        }

        const session = whiteboardSessions.get(room);
        session.users.add(socket.userId);

        const userCount = session.users.size;

        console.log(`✅ ${userName} (${socket.userRole}) joined whiteboard: ${channelName} (${userCount} users)`);

        // Send current states to new joiner
        socket.emit('lock-status', session.locked);
        socket.emit('pdf-visibility-changed', session.pdfVisibleToStudents);

        // Send current PDF if exists
        if (session.pdfData) {
          socket.emit('pdf-shared', {
            ...session.pdfData,
            visibleToStudents: session.pdfVisibleToStudents
          });
          if (session.currentPage > 1) {
            socket.emit('pdf-page-sync', { page: session.currentPage });
          }
        }

        io.to(room).emit('user-count', userCount);
        socket.to(room).emit('user-joined', {
          userId: socket.userId,
          userName,
          userRole: socket.userRole,
          userCount
        });
      } catch (err) {
        console.error('join-whiteboard error:', err.message);
      }
    });

    // Handle drawing events
    socket.on('drawing', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('drawing-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        socket.to(room).emit('drawing', data);
      } catch (err) {
        console.error('drawing error:', err.message);
      }
    });

    // Handle canvas clear
    socket.on('clear-canvas', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('clear-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        socket.to(room).emit('clear-canvas', data);
      } catch (err) {
        console.error('clear-canvas error:', err.message);
      }
    });

    // Handle lock toggle (teacher only)
    socket.on('toggle-lock', ({ channelName, locked }) => {
      try {
        if (socket.userRole !== 'teacher') {
          socket.emit('error', { message: 'Only teachers can lock/unlock' });
          return;
        }

        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (session) {
          session.locked = locked;
          io.to(room).emit('lock-status', locked);
          console.log(`🔒 Whiteboard ${channelName} ${locked ? 'LOCKED' : 'UNLOCKED'} by ${socket.userName}`);
        }
      } catch (err) {
        console.error('toggle-lock error:', err.message);
      }
    });

    // Handle PDF sharing (teacher only)
    socket.on('share-pdf', ({ channelName, pdfData, fileName, sharedBy, visibleToStudents }) => {
      try {
        if (socket.userRole !== 'teacher') {
          socket.emit('error', { message: 'Only teachers can share PDFs' });
          return;
        }

        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (session) {
          session.pdfData = { pdfData, fileName, sharedBy };
          session.pdfVisibleToStudents = visibleToStudents || false;

          io.to(room).emit('pdf-shared', {
            pdfData,
            fileName,
            sharedBy,
            visibleToStudents: session.pdfVisibleToStudents
          });

          console.log(`📄 PDF "${fileName}" shared in ${channelName} by ${sharedBy} (Students: ${visibleToStudents ? 'CAN see' : 'CANNOT see'})`);
        }
      } catch (err) {
        console.error('share-pdf error:', err.message);
      }
    });

    // Handle PDF visibility toggle (teacher only)
    socket.on('toggle-pdf-visibility', ({ channelName, visible }) => {
      try {
        if (socket.userRole !== 'teacher') {
          socket.emit('error', { message: 'Only teachers can control PDF visibility' });
          return;
        }

        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (session) {
          session.pdfVisibleToStudents = visible;
          io.to(room).emit('pdf-visibility-changed', visible);
          console.log(`👁️ PDF visibility in ${channelName}: Students ${visible ? 'CAN see' : 'CANNOT see'} (changed by ${socket.userName})`);
        }
      } catch (err) {
        console.error('toggle-pdf-visibility error:', err.message);
      }
    });

    // Handle PDF removal (teacher only)
    socket.on('remove-pdf', ({ channelName }) => {
      try {
        if (socket.userRole !== 'teacher') {
          socket.emit('error', { message: 'Only teachers can remove PDFs' });
          return;
        }

        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (session) {
          session.pdfData = null;
          session.pdfVisibleToStudents = false;
          io.to(room).emit('pdf-removed');
          console.log(`📄 PDF removed from ${channelName} by ${socket.userName}`);
        }
      } catch (err) {
        console.error('remove-pdf error:', err.message);
      }
    });

    // Leave whiteboard room
    socket.on('leave-whiteboard', ({ channelName }) => {
      try {
        const room = tenantRoom(socket, channelName);
        socket.leave(room);

        if (whiteboardSessions.has(room)) {
          const session = whiteboardSessions.get(room);
          session.users.delete(socket.userId);

          const userCount = session.users.size;

          if (userCount === 0) {
            whiteboardSessions.delete(room);
            console.log(`🗑️ Whiteboard session ${channelName} deleted (no users)`);
          } else {
            io.to(room).emit('user-count', userCount);
          }

          console.log(`👋 User ${socket.userId} left whiteboard: ${channelName} (${userCount} users remaining)`);
        }
      } catch (err) {
        console.error('leave-whiteboard error:', err.message);
      }
    });

    // ── PDF content sync (teacher → student) ────────────────────────────────

    socket.on('pdf-stroke-start', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-start', data); }
      catch (err) { console.error('pdf-stroke-start error:', err.message); }
    });

    socket.on('pdf-stroke-move', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-move', data); }
      catch (err) { console.error('pdf-stroke-move error:', err.message); }
    });

    socket.on('pdf-stroke-end', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-end', data); }
      catch (err) { console.error('pdf-stroke-end error:', err.message); }
    });

    socket.on('pdf-page-sync', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (session) session.currentPage = data.page;
        socket.to(room).emit('pdf-page-sync', data);
      } catch (err) { console.error('pdf-page-sync error:', err.message); }
    });

    socket.on('pdf-uploaded', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (session) session.currentPage = 1;
        socket.to(room).emit('pdf-uploaded', data);
      } catch (err) { console.error('pdf-uploaded error:', err.message); }
    });

    socket.on('pdf-clear-sync', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-clear-sync', data); }
      catch (err) { console.error('pdf-clear-sync error:', err.message); }
    });

    // Whiteboard canvas state sync (used for undo + join catch-up)
    socket.on('wb-sync', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('wb-sync', data); }
      catch (err) { console.error('wb-sync error:', err.message); }
    });

    // ── Emoji reactions (video call) ─────────────────────────────────────────
    socket.on('join-reactions', ({ channelName }) => {
      try {
        const room = `reactions-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        if (!socket.reactionChannels) socket.reactionChannels = new Set();
        socket.reactionChannels.add(channelName);
      } catch (err) { console.error('join-reactions error:', err.message); }
    });

    socket.on('emoji-reaction', (data) => {
      try { socket.to(`reactions-${tenantRoom(socket, data.channelName)}`).emit('emoji-reaction', data); }
      catch (err) { console.error('emoji-reaction error:', err.message); }
    });

    // ── Live chat (video call) ────────────────────────────────────────────────
    socket.on('join-chat', ({ channelName }) => {
      try {
        const room = `chat-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        console.log(`💬 Socket joined chat room: ${room}`);
      } catch (err) { console.error('join-chat error:', err.message); }
    });

    socket.on('chat-message', (data) => {
      try { socket.to(`chat-${tenantRoom(socket, data.channelName)}`).emit('chat-message', data); }
      catch (err) { console.error('chat-message error:', err.message); }
    });

    // Handle disconnect — clean up whiteboard session and reaction rooms
    socket.on('disconnect', () => {
      try {
        console.log('🔌 Socket disconnected:', socket.id);

        if (socket.roomName && socket.userId) {
          if (whiteboardSessions.has(socket.roomName)) {
            const session = whiteboardSessions.get(socket.roomName);
            session.users.delete(socket.userId);

            const userCount = session.users.size;

            if (userCount === 0) {
              whiteboardSessions.delete(socket.roomName);
            } else {
              io.to(socket.roomName).emit('user-count', userCount);
              io.to(socket.roomName).emit('user-left', {
                userId: socket.userId,
                userName: socket.userName,
                userCount
              });
            }
          }
        }

        if (socket.reactionChannels) {
          socket.reactionChannels.forEach(ch => {
            socket.leave(`reactions-${tenantRoom(socket, ch)}`);
          });
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err.message);
      }
    });
  });

  return io;
}
