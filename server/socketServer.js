// server/socketServer.js - WITH PDF VISIBILITY CONTROL
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config/config.js';
import { getCenterSecret } from './utils/jwtUtils.js';
import Center from './models/master/Center.js';
import logger from "./utils/logger.js";
import { getDb } from './config/dbManager.js';
import { ringLogSchema } from './schemas/ringLogSchema.js';
import { studentSchema } from './schemas/studentSchema.js';
import { teacherSchema } from './schemas/teacherSchema.js';
import { adminSchema } from './schemas/adminSchema.js';
import { sendPush } from './utils/webPushService.js';
import redisClient from './config/redis.js';

function getRingLog(db) {
  return db.models.RingLog || db.model("RingLog", ringLogSchema);
}

async function saveRingLog(centerId, data) {
  try {
    const db = await getDb(centerId);
    const Log = getRingLog(db);
    await Log.create(data);
  } catch (err) {
    logger.error("saveRingLog error:", { error: err?.message });
  }
}

// Send a push notification to the target user if they have a stored subscription.
// targetRole tells us which model to query.
async function sendRingPush(centerId, targetUserId, targetRole, callerName) {
  try {
    const db = await getDb(centerId);
    let Model;
    if (targetRole === 'student') Model = db.models.Student || db.model('Student', studentSchema);
    else if (targetRole === 'teacher') Model = db.models.Teacher || db.model('Teacher', teacherSchema);
    else if (targetRole === 'admin' || targetRole === 'subAdmin')
      Model = db.models.Admin || db.model('Admin', adminSchema);
    else return;

    const doc = await Model.findById(targetUserId).select('pushSubscription').lean();
    if (!doc?.pushSubscription?.endpoint) return;

    await sendPush(doc.pushSubscription, {
      title: `📞 ${callerName} is ringing you`,
      body: 'Open the app to answer',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url: '/' },
    });
  } catch (err) {
    logger.warn('sendRingPush error:', { error: err?.message });
  }
}

async function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / server-to-server
  if (config.corsOrigins.includes(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    if (hostname.endsWith('.clemify.com')) return true;
    const match = await Center.findOne({ customDomain: hostname, domainVerified: true });
    if (match) return true;
  } catch (_) { /* invalid URL */ }
  return false;
}

// Per-user rate limiter — tracks event counts in a rolling 1-second window.
// Keyed by userId+centerId so multi-tab users share one counter.
// Uses Redis when available (cross-process safe for PM2 cluster); falls back
// to an in-memory Map per worker when Redis is unavailable.
const SOCKET_RATE_LIMIT = 60;  // max events per second per user
const SOCKET_RATE_WINDOW = 1000; // ms

// In-memory fallback: socketId → { count, resetAt }
const _memCounts = new Map();
function _checkRateMemory(socketId) {
  const now = Date.now();
  const entry = _memCounts.get(socketId);
  if (!entry || now >= entry.resetAt) {
    _memCounts.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW });
    return true;
  }
  entry.count += 1;
  return entry.count <= SOCKET_RATE_LIMIT;
}

async function checkSocketRate(socket) {
  if (redisClient) {
    try {
      const key = `socket_rate:${socket.centerId}:${socket.userId}`;
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.pexpire(key, SOCKET_RATE_WINDOW);
      return count <= SOCKET_RATE_LIMIT;
    } catch {
      // Redis error — fall through to memory fallback
    }
  }
  return _checkRateMemory(socket.id);
}

export async function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        isAllowedOrigin(origin)
          .then(allowed => allowed ? callback(null, true) : callback(new Error('Not allowed by CORS')))
          .catch(() => callback(new Error('Not allowed by CORS')));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    // PDF uploads go through the REST API, not sockets.
    // 1 MB covers whiteboard strokes, chat messages, and small sync payloads.
    maxHttpBufferSize: 1e6 // 1 MB
  });

  // Redis adapter — required for Socket.IO to work correctly across PM2 cluster
  // workers. Without it, io.to(room).emit() only reaches clients on THIS worker.
  // Falls back to in-memory adapter if Redis is unavailable or the package is missing.
  if (redisClient) {
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      // ioredis auto-connects on first use; duplicate() creates a separate
      // connection required because a subscribed client can't run other commands.
      const pubClient = redisClient;
      const subClient = redisClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('✅ Socket.IO using Redis adapter (cluster-safe)');
    } catch (err) {
      logger.warn('⚠️ Socket.IO Redis adapter unavailable — using in-memory adapter. Run: npm install @socket.io/redis-adapter', { error: err?.message });
    }
  } else {
    logger.warn('⚠️ REDIS_URL not set — Socket.IO using in-memory adapter. Clustering will NOT work correctly without Redis.');
  }

  // ── JWT authentication for every socket connection ───────────────────────
  // Client must pass the auth token in handshake: io(URL, { auth: { token } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      // Decode header only (no trust) to extract centerId for secret derivation.
      // jwt.verify below then proves the centerId claim is authentic.
      const unverified = jwt.decode(token);
      if (!unverified?.centerId) return next(new Error('Invalid token'));
      const decoded = jwt.verify(token, getCenterSecret(unverified.centerId), { algorithms: ['HS256'] });
      socket.userId = decoded.id;
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

  // Track in-flight rings: ringId → { callerId, callerRoom, targetUserId, targetRoom, timeout }
  const activeRings = new Map();
  const RING_TIMEOUT_MS = 30_000; // auto-cancel after 30 seconds

  io.on('connection', (socket) => {
    logger.info('🔌 Socket connected:', socket.id, `(${socket.centerId})`);

    // Throttle all incoming events — disconnect sockets that flood the server.
    // Keyed by userId so multi-tab users share one counter across all workers.
    socket.onAny(async () => {
      if (!await checkSocketRate(socket)) {
        logger.warn(`⚠️  Socket rate limit exceeded: ${socket.id} (${socket.centerId}) — disconnecting`);
        socket.disconnect(true);
      }
    });

    // Join whiteboard room
    socket.on('join-whiteboard', ({ channelName, userName }) => {
      try {
        const room = tenantRoom(socket, channelName);
        socket.join(room);
        socket.userName = userName;
        socket.channelName = channelName; // original name kept for client-facing log messages
        socket.roomName = room;        // scoped name used for all room operations

        if (!whiteboardSessions.has(room)) {
          whiteboardSessions.set(room, {
            users: new Set(),
            locked: true,
            pdfData: null,
            pdfVisibleToStudents: false,
            currentPage: 1,
            currentScale: 1.3,
            canvasSnapshot: null,
          });
        }

        const session = whiteboardSessions.get(room);
        session.users.add(socket.userId);

        const userCount = session.users.size;

        logger.info(`✅ ${userName} (${socket.userRole}) joined whiteboard: ${channelName} (${userCount} users)`);

        // Send current states to new joiner
        socket.emit('lock-status', session.locked);
        socket.emit('pdf-visibility-changed', session.pdfVisibleToStudents);

        // Send current PDF if exists (whiteboard share-pdf flow)
        if (session.pdfData) {
          socket.emit('pdf-shared', {
            ...session.pdfData,
            visibleToStudents: session.pdfVisibleToStudents
          });
        }

        // Always send current page/zoom to new joiner so they mirror the teacher.
        // ContentViewer loads the PDF via REST API (not share-pdf), so pdfData may
        // be null even though the teacher has already navigated to a specific page.
        if (session.currentPage > 1) {
          socket.emit('pdf-page-sync', { page: session.currentPage });
        }
        if (session.currentScale && session.currentScale !== 1.3) {
          socket.emit('pdf-zoom-sync', { scale: session.currentScale });
        }

        // Restore canvas drawing for rejoining users (tab-switch recovery)
        if (session.canvasSnapshot) {
          socket.emit('canvas-state', { dataUrl: session.canvasSnapshot });
        }

        io.to(room).emit('user-count', userCount);
        socket.to(room).emit('user-joined', {
          userId: socket.userId,
          userName,
          userRole: socket.userRole,
          userCount
        });
      } catch (err) {
        logger.error('join-whiteboard error:', { error: err?.message });
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
        logger.error('drawing error:', { error: err?.message });
      }
    });

    // Persist canvas snapshot so rejoining users (tab-switch) see current drawing
    socket.on('save-canvas-state', ({ channelName, dataUrl }) => {
      try {
        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (session && dataUrl) session.canvasSnapshot = dataUrl;
      } catch (err) {
        logger.error('save-canvas-state error:', { error: err?.message });
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

        session.canvasSnapshot = null;
        socket.to(room).emit('clear-canvas', data);
      } catch (err) {
        logger.error('clear-canvas error:', { error: err?.message });
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
          logger.info(`🔒 Whiteboard ${channelName} ${locked ? 'LOCKED' : 'UNLOCKED'} by ${socket.userName}`);
        }
      } catch (err) {
        logger.error('toggle-lock error:', { error: err?.message });
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

          logger.info(`📄 PDF "${fileName}" shared in ${channelName} by ${sharedBy} (Students: ${visibleToStudents ? 'CAN see' : 'CANNOT see'})`);
        }
      } catch (err) {
        logger.error('share-pdf error:', { error: err?.message });
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
          logger.info(`👁️ PDF visibility in ${channelName}: Students ${visible ? 'CAN see' : 'CANNOT see'} (changed by ${socket.userName})`);
        }
      } catch (err) {
        logger.error('toggle-pdf-visibility error:', { error: err?.message });
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
          logger.info(`📄 PDF removed from ${channelName} by ${socket.userName}`);
        }
      } catch (err) {
        logger.error('remove-pdf error:', { error: err?.message });
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
            logger.info(`🗑️ Whiteboard session ${channelName} deleted (no users)`);
          } else {
            io.to(room).emit('user-count', userCount);
          }

          logger.info(`👋 User ${socket.userId} left whiteboard: ${channelName} (${userCount} users remaining)`);
        }
      } catch (err) {
        logger.error('leave-whiteboard error:', { error: err?.message });
      }
    });

    // ── Student personal room (dashboard real-time updates) ─────────────────
    socket.on('join-student-room', () => {
      try {
        if (socket.userRole !== 'student') return;
        const room = `student-room:${socket.centerId}:${socket.userId}`;
        socket.join(room);
        logger.info(`📡 Student ${socket.userId} joined personal room (${socket.centerId})`);
      } catch (err) { logger.error('join-student-room error:', { error: err?.message }); }
    });

    // ── Teacher personal room (booking requests, messages) ───────────────────
    socket.on('join-teacher-room', () => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `teacher-room:${socket.centerId}:${socket.userId}`;
        socket.join(room);
        logger.info(`👨‍🏫 Teacher ${socket.userId} joined personal room (${socket.centerId})`);
      } catch (err) { logger.error('join-teacher-room error:', { error: err?.message }); }
    });

    // ── Admin broadcast room (messages from teachers/students) ───────────────
    socket.on('join-admin-room', () => {
      try {
        if (!['admin', 'sub-admin'].includes(socket.userRole)) return;
        const broadcast = `admin-broadcast:${socket.centerId}`;
        const personal  = `admin-room:${socket.centerId}:${socket.userId}`;
        socket.join(broadcast);
        socket.join(personal);
        logger.info(`👔 Admin ${socket.userId} joined admin rooms (${socket.centerId})`);
      } catch (err) { logger.error('join-admin-room error:', { error: err?.message }); }
    });

    // ── User personal room (any role — required for ring notifications) ───────
    socket.on('join-user-room', () => {
      try {
        const room = `user-room:${socket.centerId}:${socket.userId}`;
        socket.join(room);
        socket.userRoomName = room;
        logger.info(`🔔 User ${socket.userId} (${socket.userRole}) joined user-room`);
      } catch (err) { logger.error('join-user-room error:', { error: err?.message }); }
    });

    // ── Ring / attention-call ─────────────────────────────────────────────────
    // Caller emits ring-call → server forwards incoming-ring to target's user-room.
    // The ring plays client-side audio and auto-cancels after RING_TIMEOUT_MS.
    socket.on('ring-call', ({ targetUserId, targetRole, callerName }) => {
      try {
        if (!targetUserId || !callerName) return;

        const callerRoom = `user-room:${socket.centerId}:${socket.userId}`;
        const targetRoom = `user-room:${socket.centerId}:${targetUserId}`;
        const ringId = `${socket.centerId}:${socket.userId}:${targetUserId}:${Date.now()}`;

        // Cancel any previous ring this caller already has in flight
        for (const [id, ring] of activeRings) {
          if (ring.callerId === socket.userId && ring.centerId === socket.centerId) {
            clearTimeout(ring.timeout);
            io.to(ring.targetRoom).emit('ring-cancelled', { ringId: id });
            activeRings.delete(id);
          }
        }

        const timeout = setTimeout(() => {
          if (activeRings.has(ringId)) {
            const r = activeRings.get(ringId);
            activeRings.delete(ringId);
            io.to(targetRoom).emit('ring-timeout', { ringId });
            io.to(callerRoom).emit('ring-timeout', { ringId });
            logger.info(`⏰ Ring ${ringId} timed out`);
            saveRingLog(r.centerId, {
              callerId: r.callerId,
              callerRole: r.callerRole,
              callerName: r.callerName,
              targetId: r.targetUserId,
              targetRole: r.targetRole,
              outcome: "missed",
            });
          }
        }, RING_TIMEOUT_MS);

        activeRings.set(ringId, {
          callerId: socket.userId,
          callerRole: socket.userRole,
          callerName,
          callerRoom,
          targetUserId,
          targetRole: targetRole || null,
          targetRoom,
          centerId: socket.centerId,
          timeout,
        });

        io.to(targetRoom).emit('incoming-ring', {
          ringId,
          callerId: socket.userId,
          callerName,
          callerRole: socket.userRole,
        });

        socket.emit('ring-sent', { ringId, targetUserId });
        logger.info(`🔔 Ring ${ringId}: ${socket.userId} (${socket.userRole}) → ${targetUserId}`);

        // Push notification so the target is alerted even when the app is in background
        if (targetRole) {
          sendRingPush(socket.centerId, targetUserId, targetRole, callerName).catch(() => { });
        }
      } catch (err) { logger.error('ring-call error:', { error: err?.message }); }
    });

    // Caller cancels the ring before it is answered
    socket.on('ring-cancel', ({ ringId }) => {
      try {
        const ring = activeRings.get(ringId);
        if (!ring || ring.callerId !== socket.userId) return;
        clearTimeout(ring.timeout);
        activeRings.delete(ringId);
        io.to(ring.targetRoom).emit('ring-cancelled', { ringId });
        logger.info(`❌ Ring ${ringId} cancelled by caller`);
      } catch (err) { logger.error('ring-cancel error:', { error: err?.message }); }
    });

    // Target answers — notify the caller so they can open the class / chat
    socket.on('ring-answered', ({ ringId }) => {
      try {
        const ring = activeRings.get(ringId);
        if (!ring || ring.targetUserId !== socket.userId) return;
        clearTimeout(ring.timeout);
        activeRings.delete(ringId);
        io.to(ring.callerRoom).emit('ring-answered', { ringId, by: socket.userId });
        logger.info(`✅ Ring ${ringId} answered by ${socket.userId}`);
      } catch (err) { logger.error('ring-answered error:', { error: err?.message }); }
    });

    // Target declines — notify the caller
    socket.on('ring-declined', ({ ringId }) => {
      try {
        const ring = activeRings.get(ringId);
        if (!ring || ring.targetUserId !== socket.userId) return;
        clearTimeout(ring.timeout);
        activeRings.delete(ringId);
        io.to(ring.callerRoom).emit('ring-declined', { ringId, by: socket.userId });
        logger.info(`🚫 Ring ${ringId} declined by ${socket.userId}`);
        saveRingLog(ring.centerId, {
          callerId: ring.callerId,
          callerRole: ring.callerRole,
          callerName: ring.callerName,
          targetId: ring.targetUserId,
          targetRole: socket.userRole,
          outcome: "declined",
        });
      } catch (err) { logger.error('ring-declined error:', { error: err?.message }); }
    });

    // ── PDF content sync (teacher → student) ────────────────────────────────

    socket.on('pdf-stroke-start', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-start', data); }
      catch (err) { logger.error('pdf-stroke-start error:', { error: err?.message }); }
    });

    socket.on('pdf-stroke-move', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-move', data); }
      catch (err) { logger.error('pdf-stroke-move error:', { error: err?.message }); }
    });

    socket.on('pdf-stroke-end', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-stroke-end', data); }
      catch (err) { logger.error('pdf-stroke-end error:', { error: err?.message }); }
    });

    socket.on('pdf-page-sync', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (session) session.currentPage = data.page;
        socket.to(room).emit('pdf-page-sync', data);
      } catch (err) { logger.error('pdf-page-sync error:', { error: err?.message }); }
    });

    socket.on('pdf-zoom-sync', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (session) session.currentScale = data.scale;
        socket.to(room).emit('pdf-zoom-sync', data);
      } catch (err) { logger.error('pdf-zoom-sync error:', { error: err?.message }); }
    });

    socket.on('pdf-uploaded', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (session) { session.currentPage = 1; session.currentScale = 1.3; }
        socket.to(room).emit('pdf-uploaded', data);
        // Auto-blink the content tab for students when teacher uploads a PDF
        socket.to(`classroom-${room}`).emit('classroom-tab-notify', { tab: 'content' });
      } catch (err) { logger.error('pdf-uploaded error:', { error: err?.message }); }
    });

    socket.on('pdf-clear-sync', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('pdf-clear-sync', data); }
      catch (err) { logger.error('pdf-clear-sync error:', { error: err?.message }); }
    });

    // Whiteboard canvas state sync (used for undo + join catch-up)
    socket.on('wb-sync', (data) => {
      try { socket.to(tenantRoom(socket, data.channelName)).emit('wb-sync', data); }
      catch (err) { logger.error('wb-sync error:', { error: err?.message }); }
    });

    // ── Classroom tab sync ────────────────────────────────────────────────────
    // Teacher emits classroom-tab-change → all students in the same session follow.
    socket.on('join-classroom-room', ({ channelName }) => {
      try {
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.join(room);
      } catch (err) { logger.error('join-classroom-room error:', { error: err?.message }); }
    });

    socket.on('classroom-tab-change', ({ channelName, tab }) => {
      try {
        if (socket.userRole !== 'teacher') return; // only teacher can push tabs
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.to(room).emit('classroom-tab-change', { tab });
      } catch (err) { logger.error('classroom-tab-change error:', { error: err?.message }); }
    });

    // Teacher manually pings a tab — student's tab button starts blinking
    socket.on('classroom-tab-notify', ({ channelName, tab }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.to(room).emit('classroom-tab-notify', { tab });
      } catch (err) { logger.error('classroom-tab-notify error:', { error: err?.message }); }
    });

    // ── Group class signaling ─────────────────────────────────────────────────
    socket.on('join-group-room', ({ groupClassId }) => {
      try {
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        socket.join(room);
        socket.groupClassId = groupClassId;
        socket.to(room).emit('group-user-joined', {
          userId: socket.userId,
          userName: socket.userName,
          role: socket.userRole,
        });
      } catch (err) { logger.error('join-group-room error:', { error: err?.message }); }
    });

    socket.on('group-hand-raise', ({ groupClassId }) => {
      try {
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        socket.to(room).emit('group-hand-raise', {
          userId: socket.userId,
          userName: socket.userName,
        });
      } catch (err) { logger.error('group-hand-raise error:', { error: err?.message }); }
    });

    socket.on('group-hand-lower', ({ groupClassId }) => {
      try {
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        socket.to(room).emit('group-hand-lower', {
          userId: socket.userId,
          userName: socket.userName,
        });
      } catch (err) { logger.error('group-hand-lower error:', { error: err?.message }); }
    });

    socket.on('group-promote', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-promote', { targetUserId });
      } catch (err) { logger.error('group-promote error:', { error: err?.message }); }
    });

    socket.on('group-demote', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-demote', { targetUserId });
      } catch (err) { logger.error('group-demote error:', { error: err?.message }); }
    });

    socket.on('group-end-class', ({ groupClassId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-class-ended', {});
      } catch (err) { logger.error('group-end-class error:', { error: err?.message }); }
    });

    socket.on('group-kick', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-kicked', { targetUserId });
      } catch (err) { logger.error('group-kick error:', { error: err?.message }); }
    });

    // ── Emoji reactions (video call) ─────────────────────────────────────────
    socket.on('join-reactions', ({ channelName }) => {
      try {
        const room = `reactions-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        if (!socket.reactionChannels) socket.reactionChannels = new Set();
        socket.reactionChannels.add(channelName);
      } catch (err) { logger.error('join-reactions error:', { error: err?.message }); }
    });

    socket.on('emoji-reaction', (data) => {
      try { socket.to(`reactions-${tenantRoom(socket, data.channelName)}`).emit('emoji-reaction', data); }
      catch (err) { logger.error('emoji-reaction error:', { error: err?.message }); }
    });

    // ── Live chat (video call) ────────────────────────────────────────────────
    socket.on('join-chat', ({ channelName }) => {
      try {
        const room = `chat-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        logger.info(`💬 Socket joined chat room: ${room}`);
      } catch (err) { logger.error('join-chat error:', { error: err?.message }); }
    });

    socket.on('chat-message', (data) => {
      try { socket.to(`chat-${tenantRoom(socket, data.channelName)}`).emit('chat-message', data); }
      catch (err) { logger.error('chat-message error:', { error: err?.message }); }
    });

    // Handle disconnect — clean up whiteboard session and reaction rooms
    socket.on('disconnect', () => {
      try {
        logger.info('🔌 Socket disconnected:', socket.id);

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

        if (socket.groupClassId) {
          const room = `group-${tenantRoom(socket, socket.groupClassId)}`;
          socket.to(room).emit('group-user-left', {
            userId: socket.userId,
            userName: socket.userName,
          });
        }

        if (socket.reactionChannels) {
          socket.reactionChannels.forEach(ch => {
            socket.leave(`reactions-${tenantRoom(socket, ch)}`);
          });
        }

        // Clean up any in-flight rings involving this socket
        for (const [ringId, ring] of activeRings) {
          if (ring.centerId !== socket.centerId) continue;
          if (ring.callerId === socket.userId) {
            clearTimeout(ring.timeout);
            io.to(ring.targetRoom).emit('ring-cancelled', { ringId, reason: 'offline' });
            activeRings.delete(ringId);
          } else if (ring.targetUserId === socket.userId) {
            clearTimeout(ring.timeout);
            io.to(ring.callerRoom).emit('ring-declined', { ringId, reason: 'offline' });
            activeRings.delete(ringId);
          }
        }
      } catch (err) {
        logger.error('disconnect cleanup error:', { error: err?.message });
      }
    });
  });

  return io;
}
