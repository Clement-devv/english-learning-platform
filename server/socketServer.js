// server/socketServer.js - WITH PDF VISIBILITY CONTROL
import { Server } from 'socket.io';

export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 10e6 // 10MB for PDF uploads
  });

  // Store active whiteboard sessions
  const whiteboardSessions = new Map(); // channelName -> { users: Set, locked: boolean, pdfData: object, pdfVisibleToStudents: boolean }

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);

    // Join whiteboard room
    socket.on('join-whiteboard', ({ channelName, userId, userName, userRole }) => {
      try {
        socket.join(channelName);
        socket.userId = userId;
        socket.userName = userName;
        socket.userRole = userRole;
        socket.channelName = channelName;

        // Initialize session if doesn't exist
        if (!whiteboardSessions.has(channelName)) {
          whiteboardSessions.set(channelName, {
            users: new Set(),
            locked: true,
            pdfData: null,
            pdfVisibleToStudents: false,
            currentPage: 1,
          });
        }

        const session = whiteboardSessions.get(channelName);
        session.users.add(userId);

        const userCount = session.users.size;

        console.log(`✅ ${userName} (${userRole}) joined whiteboard: ${channelName} (${userCount} users)`);

        // Send current states to new joiner
        socket.emit('lock-status', session.locked);
        socket.emit('pdf-visibility-changed', session.pdfVisibleToStudents);

        // Send current PDF if exists
        if (session.pdfData) {
          socket.emit('pdf-shared', {
            ...session.pdfData,
            visibleToStudents: session.pdfVisibleToStudents
          });
          // Send current page so student jumps to where teacher is
          if (session.currentPage > 1) {
            socket.emit('pdf-page-sync', { page: session.currentPage });
          }
        }

        // Notify all users in the room about user count
        io.to(channelName).emit('user-count', userCount);

        // Notify others that user joined
        socket.to(channelName).emit('user-joined', {
          userId,
          userName,
          userRole,
          userCount
        });
      } catch (err) {
        console.error('join-whiteboard error:', err.message);
      }
    });

    // Handle drawing events
    socket.on('drawing', (data) => {
      try {
        const session = whiteboardSessions.get(data.channelName);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('drawing-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        socket.to(data.channelName).emit('drawing', data);
      } catch (err) {
        console.error('drawing error:', err.message);
      }
    });

    // Handle canvas clear
    socket.on('clear-canvas', (data) => {
      try {
        const session = whiteboardSessions.get(data.channelName);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('clear-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        socket.to(data.channelName).emit('clear-canvas', data);
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

        const session = whiteboardSessions.get(channelName);
        if (session) {
          session.locked = locked;
          io.to(channelName).emit('lock-status', locked);
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

        const session = whiteboardSessions.get(channelName);
        if (session) {
          session.pdfData = { pdfData, fileName, sharedBy };
          session.pdfVisibleToStudents = visibleToStudents || false;

          io.to(channelName).emit('pdf-shared', {
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

        const session = whiteboardSessions.get(channelName);
        if (session) {
          session.pdfVisibleToStudents = visible;
          io.to(channelName).emit('pdf-visibility-changed', visible);
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

        const session = whiteboardSessions.get(channelName);
        if (session) {
          session.pdfData = null;
          session.pdfVisibleToStudents = false;
          io.to(channelName).emit('pdf-removed');
          console.log(`📄 PDF removed from ${channelName} by ${socket.userName}`);
        }
      } catch (err) {
        console.error('remove-pdf error:', err.message);
      }
    });

    // Leave whiteboard room
    socket.on('leave-whiteboard', ({ channelName, userId }) => {
      try {
        socket.leave(channelName);

        if (whiteboardSessions.has(channelName)) {
          const session = whiteboardSessions.get(channelName);
          session.users.delete(userId);

          const userCount = session.users.size;

          if (userCount === 0) {
            whiteboardSessions.delete(channelName);
            console.log(`🗑️ Whiteboard session ${channelName} deleted (no users)`);
          } else {
            io.to(channelName).emit('user-count', userCount);
          }

          console.log(`👋 User ${userId} left whiteboard: ${channelName} (${userCount} users remaining)`);
        }
      } catch (err) {
        console.error('leave-whiteboard error:', err.message);
      }
    });

    // ── PDF content sync (teacher → student) ────────────────────────────────

    socket.on('pdf-stroke-start', (data) => {
      try { socket.to(data.channelName).emit('pdf-stroke-start', data); }
      catch (err) { console.error('pdf-stroke-start error:', err.message); }
    });

    socket.on('pdf-stroke-move', (data) => {
      try { socket.to(data.channelName).emit('pdf-stroke-move', data); }
      catch (err) { console.error('pdf-stroke-move error:', err.message); }
    });

    socket.on('pdf-stroke-end', (data) => {
      try { socket.to(data.channelName).emit('pdf-stroke-end', data); }
      catch (err) { console.error('pdf-stroke-end error:', err.message); }
    });

    socket.on('pdf-page-sync', (data) => {
      try {
        const session = whiteboardSessions.get(data.channelName);
        if (session) session.currentPage = data.page;
        socket.to(data.channelName).emit('pdf-page-sync', data);
      } catch (err) { console.error('pdf-page-sync error:', err.message); }
    });

    socket.on('pdf-uploaded', (data) => {
      try {
        const session = whiteboardSessions.get(data.channelName);
        if (session) session.currentPage = 1;
        socket.to(data.channelName).emit('pdf-uploaded', data);
      } catch (err) { console.error('pdf-uploaded error:', err.message); }
    });

    socket.on('pdf-clear-sync', (data) => {
      try { socket.to(data.channelName).emit('pdf-clear-sync', data); }
      catch (err) { console.error('pdf-clear-sync error:', err.message); }
    });

    // Whiteboard canvas state sync (used for undo + join catch-up)
    socket.on('wb-sync', (data) => {
      try { socket.to(data.channelName).emit('wb-sync', data); }
      catch (err) { console.error('wb-sync error:', err.message); }
    });

    // ── Emoji reactions (video call) ─────────────────────────────────────────
    socket.on('join-reactions', ({ channelName }) => {
      try {
        socket.join(`reactions-${channelName}`);
        // Track joined reaction rooms for cleanup on disconnect
        if (!socket.reactionChannels) socket.reactionChannels = new Set();
        socket.reactionChannels.add(channelName);
      } catch (err) { console.error('join-reactions error:', err.message); }
    });

    socket.on('emoji-reaction', (data) => {
      try { socket.to(`reactions-${data.channelName}`).emit('emoji-reaction', data); }
      catch (err) { console.error('emoji-reaction error:', err.message); }
    });

    // ── Live chat (video call) ────────────────────────────────────────────────
    socket.on('join-chat', ({ channelName }) => {
      try {
        socket.join(`chat-${channelName}`);
        console.log(`💬 Socket joined chat room: chat-${channelName}`);
      } catch (err) { console.error('join-chat error:', err.message); }
    });

    socket.on('chat-message', (data) => {
      try { socket.to(`chat-${data.channelName}`).emit('chat-message', data); }
      catch (err) { console.error('chat-message error:', err.message); }
    });

    // Handle disconnect — clean up whiteboard session and reaction rooms
    socket.on('disconnect', () => {
      try {
        console.log('🔌 Socket disconnected:', socket.id);

        // Clean up whiteboard session
        if (socket.channelName && socket.userId) {
          if (whiteboardSessions.has(socket.channelName)) {
            const session = whiteboardSessions.get(socket.channelName);
            session.users.delete(socket.userId);

            const userCount = session.users.size;

            if (userCount === 0) {
              whiteboardSessions.delete(socket.channelName);
            } else {
              io.to(socket.channelName).emit('user-count', userCount);
              io.to(socket.channelName).emit('user-left', {
                userId: socket.userId,
                userName: socket.userName,
                userCount
              });
            }
          }
        }

        // Clean up reaction rooms
        if (socket.reactionChannels) {
          socket.reactionChannels.forEach(ch => {
            socket.leave(`reactions-${ch}`);
          });
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err.message);
      }
    });
  });

  return io;
}
