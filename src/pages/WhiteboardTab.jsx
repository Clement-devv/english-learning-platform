// src/pages/WhiteboardTab.jsx
// Real-time collaborative whiteboard with socket sync, undo, lock/unlock
import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client";
import {
  Pencil, Highlighter, Eraser, Trash2, Undo2, Lock, Unlock,
} from "lucide-react";

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const MAX_UNDO = 20;

// ── helpers ─────────────────────────────────────────────────────────────────

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) / rect.width,
    y: (src.clientY - rect.top)  / rect.height,
  };
}

function applyStroke(ctx, tool, color, size) {
  ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = tool === "marker" ? color + "88" : color;
  ctx.lineWidth   = tool === "marker" ? size * 3 : tool === "eraser" ? size * 5 : size;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
}

function drawOnCanvas(ctx, canvas, data) {
  const w = canvas.width;
  const h = canvas.height;
  applyStroke(ctx, data.tool, data.color, data.size);
  if (data.type === "start") {
    ctx.beginPath();
    ctx.moveTo(data.x * w, data.y * h);
  } else if (data.type === "move") {
    ctx.lineTo(data.x * w, data.y * h);
    ctx.stroke();
  }
}

// ── component ────────────────────────────────────────────────────────────────

export default function WhiteboardTab({ userRole, channelName, userId, userName }) {
  const isTeacher = userRole === "teacher";

  const canvasRef  = useRef(null);
  const socketRef  = useRef(null);
  const drawing    = useRef(false);
  const undoStack  = useRef([]);
  const ctxRef     = useRef(null);

  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#1e1e1e");
  const [size,        setSize]        = useState(3);
  const [locked,      setLocked]      = useState(true);
  const [toast,       setToast]       = useState(null);
  const [connected,   setConnected]   = useState(false);

  const toolRef  = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef  = useRef(size);
  const lockedRef = useRef(locked);

  useEffect(() => { toolRef.current  = tool;   }, [tool]);
  useEffect(() => { colorRef.current = color;  }, [color]);
  useEffect(() => { sizeRef.current  = size;   }, [size]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── canvas init + resize ──────────────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;

    const resize = () => {
      const snapshot = canvas.toDataURL();
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // restore white bg
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // restore drawing
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = snapshot;
    };

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = initCanvas();
    return cleanup;
  }, [initCanvas]);

  // ── push undo snapshot ────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current.push(canvas.toDataURL());
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
  }, []);

  // ── undo ─────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (!isTeacher && lockedRef.current) return;
    if (undoStack.current.length === 0) return;
    const snapshot = undoStack.current.pop();
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshot;
    // sync undo to others
    if (socketRef.current) {
      socketRef.current.emit("wb-sync", { channelName, snapshot });
    }
  }, [isTeacher, channelName]);

  // ── clear canvas ─────────────────────────────────────────────────────────

  const clearCanvas = useCallback((emit = true) => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (emit && socketRef.current) {
      socketRef.current.emit("clear-canvas", { channelName });
    }
  }, [channelName, pushUndo]);

  // ── socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!channelName) return;
    const socket = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-whiteboard", {
        channelName,
        userId:   userId   || "wb-user",
        userName: userName || "User",
        userRole,
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("lock-status", (isLocked) => {
      setLocked(isLocked);
      lockedRef.current = isLocked;
    });

    socket.on("drawing-blocked", () =>
      showToast("Whiteboard is locked by teacher", "warn")
    );

    // remote draw events
    socket.on("drawing", (data) => {
      const canvas = canvasRef.current;
      const ctx    = ctxRef.current;
      if (!canvas || !ctx) return;
      drawOnCanvas(ctx, canvas, data);
    });

    socket.on("clear-canvas", () => {
      // remote clear — don't emit back
      const canvas = canvasRef.current;
      const ctx    = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // wb-sync: restore a snapshot pushed by another user (undo)
    socket.on("wb-sync", ({ snapshot }) => {
      const canvas = canvasRef.current;
      const ctx    = ctxRef.current;
      if (!canvas || !ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = snapshot;
    });

    // When a new user joins, teacher pushes current canvas state
    if (isTeacher) {
      socket.on("user-joined", () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const snapshot = canvas.toDataURL();
        socket.emit("wb-sync", { channelName, snapshot });
      });
    }

    return () => {
      socket.emit("leave-whiteboard", { channelName, userId: userId || "wb-user" });
      socket.disconnect();
    };
  }, [channelName, userId, userName, userRole, isTeacher, showToast]);

  // ── pointer events ────────────────────────────────────────────────────────

  const canDraw = () => isTeacher || !lockedRef.current;

  const onPointerDown = useCallback((e) => {
    if (!canDraw()) {
      showToast("Whiteboard is locked", "warn");
      return;
    }
    e.preventDefault();
    pushUndo();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    const pos    = getPos(e, canvas);
    applyStroke(ctx, toolRef.current, colorRef.current, sizeRef.current);
    ctx.beginPath();
    ctx.moveTo(pos.x * canvas.width, pos.y * canvas.height);

    socketRef.current?.emit("drawing", {
      channelName,
      type: "start",
      x: pos.x, y: pos.y,
      tool: toolRef.current,
      color: colorRef.current,
      size: sizeRef.current,
    });
  }, [channelName, pushUndo, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    const pos    = getPos(e, canvas);
    ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
    ctx.stroke();

    socketRef.current?.emit("drawing", {
      channelName,
      type: "move",
      x: pos.x, y: pos.y,
      tool: toolRef.current,
      color: colorRef.current,
      size: sizeRef.current,
    });
  }, [channelName]);

  const onPointerUp = useCallback(() => {
    drawing.current = false;
  }, []);

  // ── keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); return; }

      switch (e.key.toLowerCase()) {
        case "p": setTool("pen");    break;
        case "m": setTool("marker"); break;
        case "e": setTool("eraser"); break;
        case "delete":
        case "backspace":
          if (isTeacher) clearCanvas(); break;
        case "l":
          if (isTeacher) toggleLock(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, clearCanvas, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── lock toggle ───────────────────────────────────────────────────────────

  const toggleLock = useCallback(() => {
    if (!isTeacher) return;
    const next = !lockedRef.current;
    setLocked(next);
    lockedRef.current = next;
    socketRef.current?.emit("toggle-lock", { channelName, locked: next });
  }, [isTeacher, channelName]);

  // ── colors ────────────────────────────────────────────────────────────────

  const COLORS = [
    "#1e1e1e", "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
    "#ffffff",
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-white select-none">

      {/* ── toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">

        {/* Tools */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {[
            { id: "pen",    Icon: Pencil,      label: "Pen (P)"    },
            { id: "marker", Icon: Highlighter, label: "Marker (M)" },
            { id: "eraser", Icon: Eraser,      label: "Eraser (E)" },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => setTool(id)}
              className={`p-2 rounded-md transition-colors ${
                tool === id
                  ? "bg-purple-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c && tool !== "eraser"
                  ? "border-gray-800 scale-125"
                  : "border-gray-300 hover:scale-110"
              }`}
              style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #ccc" : undefined }}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-4">{size}</span>
          <input
            type="range" min="1" max="24" value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24 accent-purple-600"
          />
        </div>

        <div className="flex-1" />

        {/* Undo */}
        <button
          title="Undo (Ctrl+Z)"
          onClick={undo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium"
        >
          <Undo2 className="w-4 h-4" /> Undo
        </button>

        {/* Clear — teacher only */}
        {isTeacher && (
          <button
            title="Clear (Delete)"
            onClick={() => clearCanvas()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        )}

        {/* Lock — teacher only */}
        {isTeacher && (
          <button
            title="Lock / Unlock (L)"
            onClick={toggleLock}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              locked
                ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                : "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {locked ? "Unlock" : "Lock"}
          </button>
        )}

        {/* Connection indicator */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-500" : "bg-gray-300"}`}
          title={connected ? "Connected" : "Disconnected"} />
      </div>

      {/* ── lock badge (student view) ── */}
      {!isTeacher && locked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Whiteboard is locked — you can view but not draw
        </div>
      )}

      {/* ── canvas ── */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>

      {/* ── toast ── */}
      {toast && (
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg text-sm font-medium pointer-events-none ${
            toast.type === "warn"
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-gray-800 text-white"
          }`}
        >
          {toast.type === "warn" && <Lock className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── shortcuts legend ── */}
      <div className="flex items-center gap-4 px-3 py-1 bg-gray-50 border-t border-gray-100 text-gray-400 text-xs flex-shrink-0">
        <span><kbd className="bg-gray-200 px-1 rounded">P</kbd> Pen</span>
        <span><kbd className="bg-gray-200 px-1 rounded">M</kbd> Marker</span>
        <span><kbd className="bg-gray-200 px-1 rounded">E</kbd> Eraser</span>
        <span><kbd className="bg-gray-200 px-1 rounded">Ctrl+Z</kbd> Undo</span>
        {isTeacher && <span><kbd className="bg-gray-200 px-1 rounded">Del</kbd> Clear</span>}
        {isTeacher && <span><kbd className="bg-gray-200 px-1 rounded">L</kbd> Lock/Unlock</span>}
      </div>
    </div>
  );
}
