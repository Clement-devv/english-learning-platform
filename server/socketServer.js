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
    });

    // Handle drawing events
    socket.on('drawing', (data) => {
      const session = whiteboardSessions.get(data.channelName);
      
      if (socket.userRole === 'student' && session?.locked) {
        socket.emit('drawing-blocked', { message: 'Whiteboard is locked' });
        return;
      }

      socket.to(data.channelName).emit('drawing', data);
    });

    // Handle canvas clear
    socket.on('clear-canvas', (data) => {
      const session = whiteboardSessions.get(data.channelName);
      
      if (socket.userRole === 'student' && session?.locked) {
        socket.emit('clear-blocked', { message: 'Whiteboard is locked' });
        return;
      }

      socket.to(data.channelName).emit('clear-canvas', data);
    });

    // Handle lock toggle (teacher only)
    socket.on('toggle-lock', ({ channelName, locked }) => {
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
    });

    // Handle PDF sharing (teacher only)
    socket.on('share-pdf', ({ channelName, pdfData, fileName, sharedBy, visibleToStudents }) => {
      if (socket.userRole !== 'teacher') {
        socket.emit('error', { message: 'Only teachers can share PDFs' });
        return;
      }

      const session = whiteboardSessions.get(channelName);
      if (session) {
        session.pdfData = { pdfData, fileName, sharedBy };
        session.pdfVisibleToStudents = visibleToStudents || false; // NEW
        
        // Broadcast PDF to all users in the room
        io.to(channelName).emit('pdf-shared', { 
          pdfData, 
          fileName, 
          sharedBy,
          visibleToStudents: session.pdfVisibleToStudents // NEW
        });
        
        console.log(`📄 PDF "${fileName}" shared in ${channelName} by ${sharedBy} (Students: ${visibleToStudents ? 'CAN see' : 'CANNOT see'})`);
      }
    });

    // NEW: Handle PDF visibility toggle (teacher only)
    socket.on('toggle-pdf-visibility', ({ channelName, visible }) => {
      if (socket.userRole !== 'teacher') {
        socket.emit('error', { message: 'Only teachers can control PDF visibility' });
        return;
      }

      const session = whiteboardSessions.get(channelName);
      if (session) {
        session.pdfVisibleToStudents = visible;
        
        // Broadcast visibility change to all users
        io.to(channelName).emit('pdf-visibility-changed', visible);
        
        console.log(`👁️ PDF visibility in ${channelName}: Students ${visible ? 'CAN see' : 'CANNOT see'} (changed by ${socket.userName})`);
      }
    });

    // Handle PDF removal (teacher only)
    socket.on('remove-pdf', ({ channelName }) => {
      if (socket.userRole !== 'teacher') {
        socket.emit('error', { message: 'Only teachers can remove PDFs' });
        return;
      }

      const session = whiteboardSessions.get(channelName);
      if (session) {
        session.pdfData = null;
        session.pdfVisibleToStudents = false; // NEW
        
        io.to(channelName).emit('pdf-removed');
        
        console.log(`📄 PDF removed from ${channelName} by ${socket.userName}`);
      }
    });

    // Leave whiteboard room
    socket.on('leave-whiteboard', ({ channelName, userId }) => {
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
    });

    // ── PDF content sync (teacher → student) ────────────────────────────────
    // The server simply relays these to everyone else in the room.
    // Only the teacher should emit them; the client enforces this.

    socket.on('pdf-stroke-start', (data) => {
      socket.to(data.channelName).emit('pdf-stroke-start', data);
    });

    socket.on('pdf-stroke-move', (data) => {
      socket.to(data.channelName).emit('pdf-stroke-move', data);
    });

    socket.on('pdf-stroke-end', (data) => {
      socket.to(data.channelName).emit('pdf-stroke-end', data);
    });

    socket.on('pdf-page-sync', (data) => {
      const session = whiteboardSessions.get(data.channelName);
      if (session) session.currentPage = data.page;
      socket.to(data.channelName).emit('pdf-page-sync', data);
    });

    socket.on('pdf-uploaded', (data) => {
      const session = whiteboardSessions.get(data.channelName);
      if (session) session.currentPage = 1;
      socket.to(data.channelName).emit('pdf-uploaded', data);
    });

    socket.on('pdf-clear-sync', (data) => {
      socket.to(data.channelName).emit('pdf-clear-sync', data);
    });

    // Whiteboard canvas state sync (used for undo + join catch-up)
    socket.on('wb-sync', (data) => {
      socket.to(data.channelName).emit('wb-sync', data);
    });

    // ── Emoji reactions (video call) ─────────────────────────────────────────
    socket.on('join-reactions', ({ channelName }) => {
      socket.join(`reactions-${channelName}`);
    });

    socket.on('emoji-reaction', (data) => {
      socket.to(`reactions-${data.channelName}`).emit('emoji-reaction', data);
    });

    // ── Live chat (video call) ────────────────────────────────────────────────
    socket.on('join-chat', ({ channelName }) => {
      socket.join(`chat-${channelName}`);
      console.log(`💬 Socket joined chat room: chat-${channelName}`);
    });

    socket.on('chat-message', (data) => {
      // Relay to everyone else in the chat room
      socket.to(`chat-${data.channelName}`).emit('chat-message', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);

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
    });
  });

  return io;
}