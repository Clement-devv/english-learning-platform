// server/socketServer.js - WITH PDF VISIBILITY CONTROL
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config, JWT_VERIFY_OPTIONS } from './config/config.js';
import { getCenterSecret } from './utils/jwtUtils.js';
import Center from './models/master/Center.js';
import logger from "./utils/logger.js";
import { getDb } from './config/dbManager.js';
import { ringLogSchema } from './schemas/ringLogSchema.js';
import { studentSchema } from './schemas/studentSchema.js';
import { teacherSchema } from './schemas/teacherSchema.js';
import { adminSchema } from './schemas/adminSchema.js';
import { subAdminSchema } from './schemas/subAdminSchema.js';
import { pushToUser } from './utils/webPushService.js';
import { isTokenBlacklisted, isImpersonationActive } from './middleware/authMiddleware.js';
import redisClient from './config/redis.js';
import {
  verifyChannel, verifyChat, joinedChannel, joinedChat,
  adminOnlyRoom, subAdminTeacherRoom,
} from './utils/socketAccess.js';

function getRingLog(db) {
  return db.models.RingLog || db.model("RingLog", ringLogSchema);
}

// Model holding a ring target's profile. Sub-admin tokens carry "sub-admin".
function getRingUserModel(db, role) {
  if (role === 'student') return db.models.Student || db.model('Student', studentSchema);
  if (role === 'teacher') return db.models.Teacher || db.model('Teacher', teacherSchema);
  if (role === 'admin')   return db.models.Admin   || db.model('Admin',   adminSchema);
  if (role === 'sub-admin' || role === 'subAdmin') return db.models.SubAdmin || db.model('SubAdmin', subAdminSchema);
  return null;
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
    await pushToUser(db, targetRole, targetUserId, {
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

// Look up a target user's ringEnabled preference and display name for the ring-call handler.
// Fails open (returns ringEnabled:true) so a DB error never silently blocks calls.
async function getTargetInfo(centerId, targetUserId, targetRole) {
  try {
    const db = await getDb(centerId);
    const Model = getRingUserModel(db, targetRole);
    if (!Model || !mongoose.isValidObjectId(targetUserId)) return { found: false };
    const doc = await Model.findById(targetUserId).select('firstName lastName ringEnabled').lean();
    if (!doc) return { found: false };
    const name = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
    return { found: true, ringEnabled: doc.ringEnabled !== false, targetName: name };
  } catch {
    return { found: true, ringEnabled: true, targetName: '' }; // DB hiccup — fail open, don't silently block calls
  }
}

const ROLE_LABEL = { admin: 'Admin', 'sub-admin': 'Sub-admin', teacher: 'Teacher', student: 'Student', parent: 'Parent' };
// Roles that can be rung (ring contacts are teachers, students and admins — see routes/ringRoutes.js)
const RING_TARGET_ROLES = new Set(['student', 'teacher', 'admin', 'sub-admin']);
// Whiteboard strokes kept per room for (re)joiners. Points are 0–1 fractions of
// the board, so every screen draws the same picture at its own size.
const WB_MAX_POINTS = 100_000;  // per board (~1.6 MB) — then "board full, clear it"
const WB_MAX_BATCH = 400;       // numbers (x, y pairs) in one "move" message
const WB_TOOLS = new Set(['pen', 'marker', 'eraser']);
const WB_COLOR = /^#[0-9a-f]{6}$/i;
const WB_STROKE_ID = /^[\w-]{1,40}$/;
// Content tab (PDF) pen — same id/colour/point rules as the whiteboard
const PDF_TOOLS = new Set(['pen', 'marker', 'eraser']);
const isPdfPage  = (n) => Number.isInteger(n) && n >= 1 && n <= 10_000;
const isPdfScale = (n) => typeof n === 'number' && n >= 0.5 && n <= 3;

/** Flat [x, y, x, y, …] list clamped to the board and rounded, or null if it isn't one. */
function wbCoords(arr) {
  if (!Array.isArray(arr) || arr.length === 0 || arr.length % 2 || arr.length > WB_MAX_BATCH) return null;
  if (!arr.every(Number.isFinite)) return null;
  return arr.map(n => Math.round(Math.min(1, Math.max(0, n)) * 1e4) / 1e4);
}

/** The caller's real name from the DB — the client-sent name can't be trusted (anyone could ring as "Admin"). */
async function getCallerName(socket) {
  try {
    const db = await getDb(socket.centerId);
    const Model = getRingUserModel(db, socket.userRole);
    if (Model && mongoose.isValidObjectId(socket.userId)) {
      const doc = await Model.findById(socket.userId).select('firstName lastName').lean();
      const name = `${doc?.firstName || ''} ${doc?.lastName || ''}`.trim();
      if (name) return name;
    }
  } catch { /* fall through */ }
  return ROLE_LABEL[socket.userRole] || 'Someone';
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
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    // A signed-out device must not reconnect with its still-unexpired token
    if (await isTokenBlacklisted(token)) {
      return next(new Error('Session revoked'));
    }
    try {
      // Decode header only (no trust) to extract centerId for secret derivation.
      // jwt.verify below then proves the centerId claim is authentic.
      const unverified = jwt.decode(token);
      if (!unverified?.centerId) return next(new Error('Invalid token'));
      const decoded = jwt.verify(token, getCenterSecret(unverified.centerId), JWT_VERIFY_OPTIONS);
      // A revoked super-admin impersonation can't open live connections either
      if (decoded.isImpersonation && !(await isImpersonationActive(`Bearer ${token}`, decoded.centerId))) {
        return next(new Error('Session revoked'));
      }
      socket.userId = decoded.id;
      socket.userRole = decoded.role;     // role from JWT — not trusted from client
      socket.centerId = decoded.centerId; // center slug the token was issued for
      // Verified identity for room-membership checks (utils/socketAccess.js)
      socket.authUser = {
        id: String(decoded.id), role: decoded.role,
        teacherScope: Array.isArray(decoded.teacherScope) ? decoded.teacherScope.map(String) : [],
      };
      // Device session id — lets a remote "log out this device" find and drop
      // exactly this device's connection (socket.data is visible cluster-wide)
      socket.data.sid = decoded.sid || null;
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
  // An empty board is kept a while before it's dropped — the classroom unmounts
  // the board on every tab switch, so "everyone went to the Video tab" must not
  // wipe the drawing (or reset the lock).
  const WB_IDLE_TTL = 30 * 60 * 1000;

  // users: socket id → user id. Keyed by socket, not user, so one user's second
  // tab/device leaving doesn't end the session under the one still drawing.
  const wbUserCount = (session) => new Set(session.users.values()).size;

  const leaveWbSession = (socket, room) => {
    const session = whiteboardSessions.get(room);
    if (!session || !session.users.delete(socket.id)) return null;
    if (session.users.size === 0) {
      clearTimeout(session.idleTimer);
      session.idleTimer = setTimeout(() => {
        if (whiteboardSessions.get(room) === session && session.users.size === 0) whiteboardSessions.delete(room);
      }, WB_IDLE_TTL);
      session.idleTimer.unref?.();
    }
    return session;
  };

  // Track in-flight rings: ringId → { callerId, callerRoom, targetUserId, targetRoom, timeout }
  const activeRings = new Map();
  const RING_TIMEOUT_MS = 30_000; // auto-cancel after 30 seconds

  io.on('connection', (socket) => {
    logger.debug('🔌 Socket connected:', socket.id, `(${socket.centerId})`);

    // Throttle all incoming events — disconnect sockets that flood the server.
    // Keyed by userId so multi-tab users share one counter across all workers.
    socket.onAny(async () => {
      if (!await checkSocketRate(socket)) {
        logger.warn(`⚠️  Socket rate limit exceeded: ${socket.id} (${socket.centerId}) — disconnecting`);
        socket.disconnect(true);
      }
    });

    // ── Room guards ───────────────────────────────────────────────────────────
    // Any client can emit to any room name, so every class/chat event is dropped
    // unless this socket's join for that class/chat was approved
    // (utils/socketAccess.js). Joins themselves run the real membership check.
    const onChannel = (event, handler) => socket.on(event, async (data = {}) => {
      if (!(await joinedChannel(socket, data?.channelName))) return;
      handler(data);
    });
    const onGroup = (event, handler) => socket.on(event, async (data = {}) => {
      if (!(await joinedChannel(socket, `group-${data?.groupClassId}`))) return;
      handler(data);
    });
    const onChat = (event, handler) => socket.on(event, async (data = {}) => {
      if (!(await joinedChat(socket, data?.chatId))) return;
      handler(data);
    });
    const denyJoin = (what, id) => {
      logger.warn(`🚫 Socket join refused: ${what} ${id} (${socket.userRole} ${socket.userId}, ${socket.centerId})`);
      socket.emit('error', { message: 'You are not part of this class or chat' });
    };

    // Join whiteboard room
    socket.on('join-whiteboard', async ({ channelName, userName } = {}) => {
      try {
        if (!(await verifyChannel(socket, channelName))) return denyJoin('whiteboard', channelName);
        const room = tenantRoom(socket, channelName);
        socket.join(room);
        socket.userName = userName;
        // Switching to another class's board leaves the previous one
        if (socket.roomName && socket.roomName !== room) {
          socket.leave(socket.roomName);
          leaveWbSession(socket, socket.roomName);
        }
        socket.channelName = channelName; // original name kept for client-facing log messages
        socket.roomName = room;        // scoped name used for all room operations

        if (!whiteboardSessions.has(room)) {
          whiteboardSessions.set(room, {
            users: new Map(),
            idleTimer: null,
            locked: true,
            currentPage: 1,
            currentScale: 1.3,
            // The board is a list of strokes (id → stroke, in drawing order), so
            // undo can remove one person's stroke without touching anyone else's
            strokes: new Map(),
            pointCount: 0,
            lastClear: null, // { strokes, pointCount, by } — lets the clearer undo a clear
          });
        }

        const session = whiteboardSessions.get(room);
        clearTimeout(session.idleTimer);
        session.idleTimer = null;
        session.users.set(socket.id, socket.userId);

        const userCount = wbUserCount(session);

        logger.info(`✅ ${userName} (${socket.userRole}) joined whiteboard: ${channelName} (${userCount} users)`);

        // Send current states to new joiner
        socket.emit('lock-status', session.locked);
        // Always send current page/zoom to new joiner so they mirror the teacher.
        if (session.currentPage > 1) {
          socket.emit('pdf-page-sync', { page: session.currentPage });
        }
        if (session.currentScale && session.currentScale !== 1.3) {
          socket.emit('pdf-zoom-sync', { scale: session.currentScale });
        }

        // The board as it is now (tab-switch recovery + late joiners). `you` tells
        // the client which strokes are its own, for undo.
        socket.emit('wb-strokes', { strokes: [...session.strokes.values()], you: String(socket.userId) });

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

    // Handle drawing events. A stroke is one "start" then batched "move"s:
    //   { type: 'start', id, tool, color, size, x, y }   { type: 'move', id, pts: [x, y, x, y, …] }
    // The server keeps every stroke, so it's the one copy of the board.
    onChannel('drawing', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('drawing-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        const by = String(socket.userId);
        if (data.type === 'start') {
          const pts = wbCoords([data.x, data.y]);
          if (!WB_STROKE_ID.test(data.id ?? '') || session.strokes.has(data.id) || !pts) return;
          if (!WB_TOOLS.has(data.tool) || !WB_COLOR.test(data.color ?? '')) return;
          const size = Number(data.size);
          if (!Number.isInteger(size) || size < 1 || size > 24) return;
          if (session.pointCount + 1 > WB_MAX_POINTS) return socket.emit('wb-full');

          const stroke = { id: data.id, by, tool: data.tool, color: data.color, size, pts };
          session.strokes.set(stroke.id, stroke);
          session.pointCount += 1;
          socket.to(room).emit('drawing', { type: 'start', ...stroke });
        } else if (data.type === 'move') {
          const stroke = session.strokes.get(data.id);
          const pts = wbCoords(data.pts);
          if (!stroke || stroke.by !== by || !pts?.length) return;
          if (session.pointCount + pts.length / 2 > WB_MAX_POINTS) return socket.emit('wb-full');

          stroke.pts.push(...pts);
          session.pointCount += pts.length / 2;
          socket.to(room).emit('drawing', { type: 'move', id: stroke.id, pts });
        }
      } catch (err) {
        logger.error('drawing error:', { error: err?.message });
      }
    });

    // Undo removes one of the sender's own strokes — never someone else's
    onChannel('wb-undo', ({ channelName, id }) => {
      try {
        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (!session) return;
        if (socket.userRole === 'student' && session.locked) return;
        const stroke = session.strokes.get(id);
        if (!stroke || stroke.by !== String(socket.userId)) return;

        session.strokes.delete(id);
        session.pointCount -= stroke.pts.length / 2;
        socket.to(room).emit('wb-undo', { id });
      } catch (err) { logger.error('wb-undo error:', { error: err?.message }); }
    });

    // Undo of a clear — only by whoever cleared, and only the latest clear.
    // Strokes drawn since the clear stay on top.
    onChannel('wb-undo-clear', ({ channelName }) => {
      try {
        const room = tenantRoom(socket, channelName);
        const session = whiteboardSessions.get(room);
        if (!session?.lastClear || session.lastClear.by !== String(socket.userId)) return;
        if (socket.userRole === 'student' && session.locked) return;

        const { strokes, pointCount } = session.lastClear;
        session.strokes = new Map([...strokes, ...session.strokes]);
        session.pointCount += pointCount;
        session.lastClear = null;
        io.to(room).emit('wb-strokes', { strokes: [...session.strokes.values()] });
      } catch (err) { logger.error('wb-undo-clear error:', { error: err?.message }); }
    });

    // Handle canvas clear
    onChannel('clear-canvas', (data) => {
      try {
        const room = tenantRoom(socket, data.channelName);
        const session = whiteboardSessions.get(room);
        if (!session) return;

        if (socket.userRole === 'student' && session.locked) {
          socket.emit('clear-blocked', { message: 'Whiteboard is locked' });
          return;
        }

        session.lastClear = { strokes: session.strokes, pointCount: session.pointCount, by: String(socket.userId) };
        session.strokes = new Map();
        session.pointCount = 0;
        socket.to(room).emit('clear-canvas', { channelName: data.channelName });
      } catch (err) {
        logger.error('clear-canvas error:', { error: err?.message });
      }
    });

    // Handle lock toggle (teacher only)
    onChannel('toggle-lock', ({ channelName, locked }) => {
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

    // Leave whiteboard room
    socket.on('leave-whiteboard', ({ channelName }) => {
      try {
        const room = tenantRoom(socket, channelName);
        socket.leave(room);
        if (socket.roomName === room) socket.roomName = null;

        const session = leaveWbSession(socket, room);
        if (session) {
          const userCount = wbUserCount(session);
          if (userCount > 0) io.to(room).emit('user-count', userCount);
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
        logger.debug(`📡 Student ${socket.userId} joined personal room (${socket.centerId})`);
      } catch (err) { logger.error('join-student-room error:', { error: err?.message }); }
    });

    // ── Teacher personal room (booking requests, messages) ───────────────────
    socket.on('join-teacher-room', () => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `teacher-room:${socket.centerId}:${socket.userId}`;
        socket.join(room);
        logger.debug(`👨‍🏫 Teacher ${socket.userId} joined personal room (${socket.centerId})`);
      } catch (err) { logger.error('join-teacher-room error:', { error: err?.message }); }
    });

    // ── Admin broadcast room (messages from teachers/students) ───────────────
    socket.on('join-admin-room', () => {
      try {
        if (!['admin', 'sub-admin'].includes(socket.userRole)) return;
        const broadcast = `admin-broadcast:${socket.centerId}`;
        const personal  = `admin-room:${socket.centerId}:${socket.userId}`;
        socket.join(broadcast); // content-free signals only (data-changed)
        socket.join(personal);
        // Content (message previews, class presence): admins see the whole center;
        // a sub-admin only what concerns the teachers in their scope.
        if (socket.userRole === 'admin') {
          socket.join(adminOnlyRoom(socket.centerId));
        } else {
          for (const t of socket.authUser.teacherScope) socket.join(subAdminTeacherRoom(socket.centerId, t));
        }
        logger.debug(`👔 Admin ${socket.userId} joined admin rooms (${socket.centerId})`);
      } catch (err) { logger.error('join-admin-room error:', { error: err?.message }); }
    });

    // ── User personal room (any role — required for ring notifications) ───────
    socket.on('join-user-room', () => {
      try {
        const room = `user-room:${socket.centerId}:${socket.userId}`;
        socket.join(room);
        socket.userRoomName = room;
        logger.debug(`🔔 User ${socket.userId} (${socket.userRole}) joined user-room`);
      } catch (err) { logger.error('join-user-room error:', { error: err?.message }); }
    });

    // ── Ring / attention-call ─────────────────────────────────────────────────
    // Caller emits ring-call → server checks target's ringEnabled preference,
    // then forwards incoming-ring to target's user-room.
    // The ring plays client-side audio and auto-cancels after RING_TIMEOUT_MS.
    socket.on('ring-call', async ({ targetUserId, targetRole } = {}) => {
      try {
        // targetRole is required: without it the "calls muted" check used to be skipped
        if (!targetUserId || typeof targetUserId !== 'string' || !RING_TARGET_ROLES.has(targetRole)) return;

        const callerRoom = `user-room:${socket.centerId}:${socket.userId}`;
        const targetRoom = `user-room:${socket.centerId}:${targetUserId}`;
        const ringId = `${socket.centerId}:${socket.userId}:${targetUserId}:${Date.now()}`;

        // Check target's ring preference + resolve display names (never trust the client's callerName)
        const [info, callerName] = await Promise.all([
          getTargetInfo(socket.centerId, targetUserId, targetRole),
          getCallerName(socket),
        ]);
        if (!info.found) {
          socket.emit('ring-declined', { ringId, reason: 'unavailable' });
          return;
        }
        const targetName = info.targetName;
        if (!info.ringEnabled) {
          // Auto-decline immediately — don't bother the target or play ringtone
          socket.emit('ring-declined', { ringId, reason: 'muted' });
          logger.info(`🔕 Ring ${ringId} auto-declined — target has calls muted`);
          return;
        }

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
              callerId: r.callerId,   callerRole: r.callerRole,
              callerName: r.callerName,
              targetId: r.targetUserId, targetRole: r.targetRole,
              targetName: r.targetName,
              outcome: "missed",
            });
          }
        }, RING_TIMEOUT_MS);

        activeRings.set(ringId, {
          callerId: socket.userId,  callerRole: socket.userRole,
          callerName,               callerRoom,
          targetUserId,             targetRole: targetRole || null,
          targetName,               targetRoom,
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
        sendRingPush(socket.centerId, targetUserId, targetRole, callerName).catch(() => { });
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

    // Target answers — notify the caller + log the outcome
    socket.on('ring-answered', ({ ringId }) => {
      try {
        const ring = activeRings.get(ringId);
        if (!ring || ring.targetUserId !== socket.userId) return;
        clearTimeout(ring.timeout);
        activeRings.delete(ringId);
        io.to(ring.callerRoom).emit('ring-answered', { ringId, by: socket.userId });
        // Silence the same user's other open tabs/devices
        socket.to(ring.targetRoom).emit('ring-cancelled', { ringId });
        logger.info(`✅ Ring ${ringId} answered by ${socket.userId}`);
        saveRingLog(ring.centerId, {
          callerId: ring.callerId,   callerRole: ring.callerRole,
          callerName: ring.callerName,
          targetId: ring.targetUserId, targetRole: socket.userRole,
          targetName: ring.targetName,
          outcome: "answered",
        });
      } catch (err) { logger.error('ring-answered error:', { error: err?.message }); }
    });

    // Target declines — notify the caller + log the outcome
    socket.on('ring-declined', ({ ringId }) => {
      try {
        const ring = activeRings.get(ringId);
        if (!ring || ring.targetUserId !== socket.userId) return;
        clearTimeout(ring.timeout);
        activeRings.delete(ringId);
        io.to(ring.callerRoom).emit('ring-declined', { ringId, by: socket.userId });
        // Silence the same user's other open tabs/devices
        socket.to(ring.targetRoom).emit('ring-cancelled', { ringId });
        logger.info(`🚫 Ring ${ringId} declined by ${socket.userId}`);
        saveRingLog(ring.centerId, {
          callerId: ring.callerId,   callerRole: ring.callerRole,
          callerName: ring.callerName,
          targetId: ring.targetUserId, targetRole: socket.userRole,
          targetName: ring.targetName,
          outcome: "declined",
        });
      } catch (err) { logger.error('ring-declined error:', { error: err?.message }); }
    });

    // ── PDF content sync (teacher → student) ────────────────────────────────

    // Only the class teacher drives the content tab (page, zoom, PDF, pen) —
    // these used to be relayed from anyone in the class.
    const onTeacherContent = (event, handler) => onChannel(event, (data) => {
      if (socket.userRole !== 'teacher') return;
      try {
        const room = tenantRoom(socket, data.channelName);
        handler(data, room, whiteboardSessions.get(room));
      } catch (err) { logger.error(`${event} error:`, { error: err?.message }); }
    });

    onTeacherContent('pdf-stroke-start', (data, room) => {
      const pts = wbCoords([data.x, data.y]);
      if (!isPdfPage(data.page) || !WB_STROKE_ID.test(data.id ?? '') || !pts) return;
      if (!PDF_TOOLS.has(data.strokeTool) || !WB_COLOR.test(data.strokeColor ?? '')) return;
      socket.to(room).emit('pdf-stroke-start', {
        page: data.page, id: data.id, x: pts[0], y: pts[1], strokeTool: data.strokeTool, strokeColor: data.strokeColor,
      });
    });

    onTeacherContent('pdf-stroke-move', (data, room) => {
      const pts = wbCoords(data.pts);
      if (!isPdfPage(data.page) || !WB_STROKE_ID.test(data.id ?? '') || !pts) return;
      socket.to(room).emit('pdf-stroke-move', { page: data.page, id: data.id, pts });
    });

    onTeacherContent('pdf-stroke-end', (data, room) => {
      if (!isPdfPage(data.page) || !WB_STROKE_ID.test(data.id ?? '')) return;
      socket.to(room).emit('pdf-stroke-end', { page: data.page, id: data.id });
    });

    onTeacherContent('pdf-page-sync', (data, room, session) => {
      if (!isPdfPage(data.page)) return;
      if (session) session.currentPage = data.page;
      socket.to(room).emit('pdf-page-sync', { page: data.page });
    });

    onTeacherContent('pdf-zoom-sync', (data, room, session) => {
      if (!isPdfScale(data.scale)) return;
      if (session) session.currentScale = data.scale;
      socket.to(room).emit('pdf-zoom-sync', { scale: data.scale });
    });

    onTeacherContent('pdf-uploaded', (_data, room, session) => {
      if (session) { session.currentPage = 1; session.currentScale = 1.3; }
      socket.to(room).emit('pdf-uploaded', {});
      // Auto-blink the content tab for students when teacher uploads a PDF
      socket.to(`classroom-${room}`).emit('classroom-tab-notify', { tab: 'content' });
    });

    onTeacherContent('pdf-clear-sync', (data, room) => {
      if (!isPdfPage(data.page)) return;
      socket.to(room).emit('pdf-clear-sync', { page: data.page });
    });

    // ── Classroom tab sync ────────────────────────────────────────────────────
    // Teacher emits classroom-tab-change → all students in the same session follow.
    socket.on('join-classroom-room', async ({ channelName } = {}) => {
      try {
        if (!(await verifyChannel(socket, channelName))) return denyJoin('classroom', channelName);
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.join(room);
      } catch (err) { logger.error('join-classroom-room error:', { error: err?.message }); }
    });

    onChannel('classroom-tab-change', ({ channelName, tab }) => {
      try {
        if (socket.userRole !== 'teacher') return; // only teacher can push tabs
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.to(room).emit('classroom-tab-change', { tab });
      } catch (err) { logger.error('classroom-tab-change error:', { error: err?.message }); }
    });

    // Teacher manually pings a tab — student's tab button starts blinking
    onChannel('classroom-tab-notify', ({ channelName, tab }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `classroom-${tenantRoom(socket, channelName)}`;
        socket.to(room).emit('classroom-tab-notify', { tab });
      } catch (err) { logger.error('classroom-tab-notify error:', { error: err?.message }); }
    });

    // ── Group class signaling ─────────────────────────────────────────────────
    socket.on('join-group-room', async ({ groupClassId } = {}) => {
      try {
        if (!(await verifyChannel(socket, `group-${groupClassId}`))) return denyJoin('group class', groupClassId);
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

    onGroup('group-hand-raise', ({ groupClassId }) => {
      try {
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        socket.to(room).emit('group-hand-raise', {
          userId: socket.userId,
          userName: socket.userName,
        });
      } catch (err) { logger.error('group-hand-raise error:', { error: err?.message }); }
    });

    onGroup('group-hand-lower', ({ groupClassId }) => {
      try {
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        socket.to(room).emit('group-hand-lower', {
          userId: socket.userId,
          userName: socket.userName,
        });
      } catch (err) { logger.error('group-hand-lower error:', { error: err?.message }); }
    });

    onGroup('group-promote', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-promote', { targetUserId });
      } catch (err) { logger.error('group-promote error:', { error: err?.message }); }
    });

    onGroup('group-demote', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-demote', { targetUserId });
      } catch (err) { logger.error('group-demote error:', { error: err?.message }); }
    });

    onGroup('group-end-class', ({ groupClassId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-class-ended', {});
      } catch (err) { logger.error('group-end-class error:', { error: err?.message }); }
    });

    onGroup('group-kick', ({ groupClassId, targetUserId }) => {
      try {
        if (socket.userRole !== 'teacher') return;
        const room = `group-${tenantRoom(socket, groupClassId)}`;
        io.to(room).emit('group-kicked', { targetUserId });
      } catch (err) { logger.error('group-kick error:', { error: err?.message }); }
    });

    // ── Emoji reactions (video call) ─────────────────────────────────────────
    socket.on('join-reactions', async ({ channelName } = {}) => {
      try {
        if (!(await verifyChannel(socket, channelName))) return denyJoin('reactions', channelName);
        const room = `reactions-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        if (!socket.reactionChannels) socket.reactionChannels = new Set();
        socket.reactionChannels.add(channelName);
      } catch (err) { logger.error('join-reactions error:', { error: err?.message }); }
    });

    onChannel('emoji-reaction', (data) => {
      try { socket.to(`reactions-${tenantRoom(socket, data.channelName)}`).emit('emoji-reaction', data); }
      catch (err) { logger.error('emoji-reaction error:', { error: err?.message }); }
    });

    // ── Live chat (video call) ────────────────────────────────────────────────
    socket.on('join-chat', async ({ channelName } = {}) => {
      try {
        if (!(await verifyChannel(socket, channelName))) return denyJoin('call chat', channelName);
        const room = `chat-${tenantRoom(socket, channelName)}`;
        socket.join(room);
        logger.debug(`💬 Socket joined chat room: ${room}`);
      } catch (err) { logger.error('join-chat error:', { error: err?.message }); }
    });

    onChannel('chat-message', (data) => {
      try { socket.to(`chat-${tenantRoom(socket, data.channelName)}`).emit('chat-message', data); }
      catch (err) { logger.error('chat-message error:', { error: err?.message }); }
    });

    // ── Chat-message rooms (typing indicators + real-time delivery) ─────────
    socket.on('join-chat-room', async ({ chatId } = {}) => {
      try {
        if (!chatId) return;
        if (!(await verifyChat(socket, chatId))) return denyJoin('chat', chatId);
        socket.join(`chat-msg:${socket.centerId}:${chatId}`);
      } catch (err) { logger.error('join-chat-room error:', { error: err?.message }); }
    });

    socket.on('leave-chat-room', ({ chatId }) => {
      try {
        if (!chatId) return;
        socket.leave(`chat-msg:${socket.centerId}:${chatId}`);
      } catch (err) { logger.error('leave-chat-room error:', { error: err?.message }); }
    });

    onChat('typing-start', ({ chatId, senderName }) => {
      try {
        if (!chatId) return;
        socket.to(`chat-msg:${socket.centerId}:${chatId}`)
          .emit('user-typing', { chatId, name: senderName || '', role: socket.userRole });
      } catch (err) { logger.error('typing-start error:', { error: err?.message }); }
    });

    onChat('typing-stop', ({ chatId }) => {
      try {
        if (!chatId) return;
        socket.to(`chat-msg:${socket.centerId}:${chatId}`)
          .emit('user-stopped-typing', { chatId });
      } catch (err) { logger.error('typing-stop error:', { error: err?.message }); }
    });

    // Handle disconnect — clean up whiteboard session and reaction rooms
    socket.on('disconnect', () => {
      _memCounts.delete(socket.id); // rate-limit counter would otherwise outlive the socket
      try {
        logger.debug('🔌 Socket disconnected:', socket.id);

        if (socket.roomName) {
          const session = leaveWbSession(socket, socket.roomName);
          const userCount = session ? wbUserCount(session) : 0;
          if (userCount > 0) {
            io.to(socket.roomName).emit('user-count', userCount);
            io.to(socket.roomName).emit('user-left', {
              userId: socket.userId,
              userName: socket.userName,
              userCount
            });
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

        // Clean up any in-flight rings involving this user and log outcomes —
        // but only once their LAST tab/device is gone. Closing one of several
        // tabs must not cancel a ring or tell the caller "offline".
        const hasRing = [...activeRings.values()].some(r =>
          r.centerId === socket.centerId && (r.callerId === socket.userId || r.targetUserId === socket.userId));
        if (!hasRing) return;
        const userRoom = `user-room:${socket.centerId}:${socket.userId}`;
        io.in(userRoom).fetchSockets()
          .then(remaining => { if (remaining.length === 0) cleanUpRings(); })
          .catch(() => cleanUpRings());
      } catch (err) {
        logger.error('disconnect cleanup error:', { error: err?.message });
      }

      function cleanUpRings() {
        for (const [ringId, ring] of activeRings) {
          if (ring.centerId !== socket.centerId) continue;
          if (ring.callerId === socket.userId) {
            // Caller went offline — cancel the ring for the target
            clearTimeout(ring.timeout);
            io.to(ring.targetRoom).emit('ring-cancelled', { ringId, reason: 'offline' });
            activeRings.delete(ringId);
            saveRingLog(ring.centerId, {
              callerId: ring.callerId,   callerRole: ring.callerRole,
              callerName: ring.callerName,
              targetId: ring.targetUserId, targetRole: ring.targetRole,
              targetName: ring.targetName,
              outcome: "missed",
            });
          } else if (ring.targetUserId === socket.userId) {
            // Target went offline — notify caller as a decline
            clearTimeout(ring.timeout);
            io.to(ring.callerRoom).emit('ring-declined', { ringId, reason: 'offline' });
            activeRings.delete(ringId);
            saveRingLog(ring.centerId, {
              callerId: ring.callerId,   callerRole: ring.callerRole,
              callerName: ring.callerName,
              targetId: ring.targetUserId, targetRole: ring.targetRole,
              targetName: ring.targetName,
              outcome: "missed",
            });
          }
        }
      }
    });
  });

  return io;
}
