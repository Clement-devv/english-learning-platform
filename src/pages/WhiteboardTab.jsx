// src/pages/WhiteboardTab.jsx
// Real-time collaborative whiteboard with socket sync, undo, lock/unlock.
// The board is a list of strokes kept by the server (socketServer.js "drawing"):
// undo removes only your own stroke, and every screen redraws the same picture.
import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client";
import {
  Pencil, Highlighter, Eraser, Trash2, Undo2, Lock, Unlock,
} from "lucide-react";

// In production with custom domains the socket server is on the same origin.
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "";

const getSocketToken = () =>
  sessionStorage.getItem("teacherToken") ||
  sessionStorage.getItem("studentToken") ||
  sessionStorage.getItem("adminToken") ||
  localStorage.getItem("teacherToken") ||
  localStorage.getItem("studentToken") ||
  localStorage.getItem("adminToken");

// Everyone gets the same board shape (letterboxed to fit), so a drawing never
// looks stretched on a screen of a different shape.
const BOARD_RATIO = 16 / 9;
// Brush sizes are in "board pixels" of a 1000-wide board, so a line is as thick
// relative to the board on a phone as on a big monitor.
const BOARD_UNITS = 1000;
// Moves are sent in batches — one message per pointermove went past the
// server's 60 events/second limit on fast screens and pens, which disconnects.
const SEND_EVERY_MS = 40;
const MAX_BATCH = 400; // numbers per batch — matches the server's WB_MAX_BATCH

// ── helpers ─────────────────────────────────────────────────────────────────

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clamp = (n) => Math.min(1, Math.max(0, n));
  return {
    x: clamp((e.clientX - rect.left) / rect.width),
    y: clamp((e.clientY - rect.top)  / rect.height),
  };
}

const newStrokeId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function applyStroke(ctx, canvas, tool, color, size) {
  const k = canvas.width / BOARD_UNITS;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : tool === "marker" ? color + "88" : color;
  ctx.lineWidth   = (tool === "marker" ? size * 3 : tool === "eraser" ? size * 5 : size) * k;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
}

// Draw points pts[from…] of a stroke, joined to the point before `from` (if any).
// pts is a flat [x, y, x, y, …] list of 0–1 board fractions.
function drawStroke(ctx, canvas, stroke, from = 0) {
  const { pts } = stroke;
  const w = canvas.width;
  const h = canvas.height;
  const start = Math.max(0, from - 2);
  if (pts.length < 2) return;
  applyStroke(ctx, canvas, stroke.tool, stroke.color, stroke.size);
  ctx.beginPath();
  ctx.moveTo(pts[start] * w, pts[start + 1] * h);
  if (pts.length - start === 2) ctx.lineTo(pts[start] * w, pts[start + 1] * h); // a tap is a dot
  for (let i = start + 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * w, pts[i + 1] * h);
  ctx.stroke();
}

// ── component ────────────────────────────────────────────────────────────────

export default function WhiteboardTab({ userRole, channelName, userName }) {
  const isTeacher = userRole === "teacher";

  const boxRef     = useRef(null);
  const canvasRef  = useRef(null);
  const socketRef  = useRef(null);
  const ctxRef     = useRef(null);
  const strokes    = useRef(new Map()); // id → { id, by, tool, color, size, pts } in drawing order
  const meRef      = useRef(null);      // my user id, from the server — marks my strokes
  const myActions  = useRef([]);        // what undo walks back: { id } of my strokes, or { clear: true }
  const current    = useRef(null);      // the stroke I'm drawing right now
  const pending    = useRef([]);        // its points not sent yet
  const sendTimer  = useRef(null);
  const toastTimer = useRef(null);

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
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(sendTimer.current); }, []);

  // ── drawing the board ─────────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes.current.values()) drawStroke(ctx, canvas, s);
  }, []);

  // ── canvas fit + resize ───────────────────────────────────────────────────
  // The canvas is the largest 16:9 box that fits; resizing just redraws the
  // strokes, so nothing gets blurrier.

  useEffect(() => {
    const box    = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    ctxRef.current = canvas.getContext("2d");

    const fit = () => {
      const W = box.clientWidth;
      const H = box.clientHeight;
      if (!W || !H) return; // hidden — keep the drawing
      const w = Math.min(W, H * BOARD_RATIO);
      const h = w / BOARD_RATIO;
      const dpr = window.devicePixelRatio || 1; // sharp lines on high-DPI screens
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // ── undo (only my own strokes) ────────────────────────────────────────────

  const undo = useCallback(() => {
    if (!isTeacher && lockedRef.current) return;
    if (current.current) return; // not mid-stroke
    while (myActions.current.length) {
      const action = myActions.current.pop();
      if (action.clear) {
        socketRef.current?.emit("wb-undo-clear", { channelName }); // server sends the board back
        return;
      }
      if (strokes.current.delete(action.id)) {
        redraw();
        socketRef.current?.emit("wb-undo", { channelName, id: action.id });
        return;
      }
      // that stroke was already cleared away — try the one before
    }
  }, [isTeacher, channelName, redraw]);

  // ── clear canvas ─────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    strokes.current.clear();
    myActions.current.push({ clear: true });
    redraw();
    socketRef.current?.emit("clear-canvas", { channelName });
  }, [channelName, redraw]);

  // ── socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!channelName) return;
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { token: getSocketToken() },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-whiteboard", {
        channelName,
        userName: userName || "User",
        // userId and userRole are now derived from the JWT on the server
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("lock-status", (isLocked) => {
      setLocked(isLocked);
      lockedRef.current = isLocked;
      // a student mid-stroke stops when the teacher locks (the server drops the rest anyway)
      if (isLocked && !isTeacher) current.current = null;
    });

    socket.on("drawing-blocked", () =>
      showToast("Whiteboard is locked by teacher", "warn")
    );

    socket.on("wb-full", () =>
      showToast("The board is full — clear it to keep drawing", "warn")
    );

    // the whole board — on (re)join, and after a clear is undone
    socket.on("wb-strokes", ({ strokes: list, you } = {}) => {
      if (!Array.isArray(list)) return;
      if (you != null) meRef.current = String(you);
      strokes.current = new Map(list.map((s) => [s.id, s]));
      // after a remount my undo history is gone — rebuild it from my strokes
      myActions.current = list.filter((s) => s.by === meRef.current).map((s) => ({ id: s.id }));
      current.current = null;
      redraw();
    });

    // remote strokes — each has its own id, so two people drawing never mix
    socket.on("drawing", (data) => {
      const canvas = canvasRef.current;
      const ctx    = ctxRef.current;
      if (!canvas || !ctx || !data || !Array.isArray(data.pts)) return;
      if (data.type === "start") {
        const stroke = { id: data.id, by: data.by, tool: data.tool, color: data.color, size: data.size, pts: [...data.pts] };
        strokes.current.set(stroke.id, stroke);
        drawStroke(ctx, canvas, stroke);
      } else if (data.type === "move") {
        const stroke = strokes.current.get(data.id);
        if (!stroke) return;
        const from = stroke.pts.length;
        stroke.pts.push(...data.pts);
        drawStroke(ctx, canvas, stroke, from);
      }
    });

    socket.on("wb-undo", ({ id } = {}) => {
      if (strokes.current.delete(id)) redraw();
    });

    socket.on("clear-canvas", () => {
      // remote clear — don't emit back (and end my stroke: the server dropped it too)
      strokes.current.clear();
      current.current = null;
      redraw();
    });

    return () => {
      socket.emit("leave-whiteboard", { channelName });
      socket.disconnect();
    };
  }, [channelName, userName, isTeacher, showToast, redraw]);

  // ── pointer events ────────────────────────────────────────────────────────

  const canDraw = () => isTeacher || !lockedRef.current;

  const flush = useCallback(() => {
    clearTimeout(sendTimer.current);
    sendTimer.current = null;
    const stroke = current.current;
    if (!stroke || pending.current.length === 0) return;
    socketRef.current?.emit("drawing", { channelName, type: "move", id: stroke.id, pts: pending.current });
    pending.current = [];
  }, [channelName]);

  const onPointerDown = useCallback((e) => {
    if (!canDraw()) {
      showToast("Whiteboard is locked", "warn");
      return;
    }
    if (e.button !== 0 || current.current) return; // left button / one finger only
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep the stroke if the pointer leaves the canvas
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    const pos    = getPos(e, canvas);
    const stroke = {
      id: newStrokeId(), by: meRef.current,
      tool: toolRef.current, color: colorRef.current, size: sizeRef.current,
      pts: [pos.x, pos.y],
    };
    current.current = stroke;
    pending.current = [];
    strokes.current.set(stroke.id, stroke);
    myActions.current.push({ id: stroke.id });
    drawStroke(ctx, canvas, stroke);

    socketRef.current?.emit("drawing", {
      channelName,
      type: "start",
      id: stroke.id,
      x: pos.x, y: pos.y,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
    });
  }, [channelName, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    const stroke = current.current;
    if (!stroke) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos    = getPos(e, canvas);
    const from   = stroke.pts.length;
    stroke.pts.push(pos.x, pos.y);
    drawStroke(ctxRef.current, canvas, stroke, from);

    pending.current.push(pos.x, pos.y);
    if (pending.current.length >= MAX_BATCH) flush();
    else if (!sendTimer.current) sendTimer.current = setTimeout(flush, SEND_EVERY_MS);
  }, [flush]);

  const onPointerUp = useCallback(() => {
    if (!current.current) return;
    flush();
    current.current = null;
  }, [flush]);

  // ── keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName) || el?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      // leave browser shortcuts alone (Ctrl+L used to lock the board, Ctrl+P switched tool)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "p": setTool("pen");    break;
        case "m": setTool("marker"); break;
        case "e": setTool("eraser"); break;
        // Delete only — Backspace is pressed by habit and wiped everyone's board
        case "delete":
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
    <div className="relative h-full flex flex-col bg-white select-none">

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

      {/* ── canvas ── */}
      <div ref={boxRef} className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center bg-gray-100">
        <canvas
          ref={canvasRef}
          className="block bg-white shadow-sm"
          // touch-action: none stops the page scrolling/zooming while drawing on a phone or tablet
          style={{ cursor: tool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
        />

        {/* ── lock badge (student view) — overlaid so toggling it doesn't resize (and blur) the canvas ── */}
        {!isTeacher && locked && (
          <div className="absolute top-0 inset-x-0 flex items-center gap-2 px-4 py-2 bg-amber-50/95 border-b border-amber-200 text-amber-700 text-sm pointer-events-none">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Whiteboard is locked — you can view but not draw
          </div>
        )}
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
