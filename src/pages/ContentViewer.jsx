// src/pages/ContentViewer.jsx
// Content tab: the teacher's PDF, page, zoom and pen marks, mirrored to the student.
// Live updates go over the socket; the DB (content-state) is the fallback the
// student polls and what the teacher comes back to after switching tabs.
import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import io from "socket.io-client";
import api from "../api";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Upload, Pencil, Highlighter, Eraser, MousePointer,
  Trash2, Loader,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#000000"];

// In production the socket server is on the same origin (it used to fall back
// to localhost:5000, so without VITE_SOCKET_URL nothing synced live).
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "";

const getSocketToken = () =>
  sessionStorage.getItem("teacherToken") ||
  sessionStorage.getItem("studentToken") ||
  sessionStorage.getItem("adminToken") ||
  localStorage.getItem("teacherToken") ||
  localStorage.getItem("studentToken") ||
  localStorage.getItem("adminToken");

// Pen widths are relative to an 800-px-wide page, so marks keep their size on
// the page at any zoom and on any screen.
const PAGE_UNITS = 800;
// Pen moves are batched — one socket message per pointermove went past the
// server's 60 events/second limit, which disconnects the teacher.
const SEND_EVERY_MS = 40;
const MAX_BATCH = 400; // numbers per batch — matches the server's limit
// After a live socket update, ignore the (slower) DB poll for a moment so it
// can't flip the student back to the previous page or remove a fresh stroke.
const LIVE_GRACE_MS = 3000;

const round4 = (n) => Math.round(n * 1e4) / 1e4;
const newStrokeId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Saved/received stroke list for one page, or [] if it isn't one. */
function parseStrokes(json) {
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.filter((s) => Array.isArray(s?.points)) : [];
  } catch { return []; }
}

// Draw points [from…] of a stroke, joined to the point before `from` (if any).
function drawStrokePart(ctx, canvas, stroke, from = 0) {
  const pts = stroke.points;
  if (!pts?.length) return;
  const w = canvas.width;
  const h = canvas.height;
  const start = Math.max(0, from - 1);
  applyStrokeStyle(ctx, stroke.tool, stroke.color, w / PAGE_UNITS);
  ctx.beginPath();
  ctx.moveTo(pts[start].x * w, pts[start].y * h);
  if (pts.length - start === 1) ctx.lineTo(pts[start].x * w, pts[start].y * h); // a tap is a dot
  for (let i = start + 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export default function ContentViewer({ bookingId, userRole, channelName }) {
  const isTeacher = userRole === "teacher";

  // ── PDF state ──────────────────────────────────────────────────────────────
  const [pdfDoc,      setPdfDoc]      = useState(null);
  const [numPages,    setNumPages]    = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale,       setScale]       = useState(1.3);
  const [hasPdf,      setHasPdf]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [rendering,   setRendering]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploading,   setUploading]   = useState(false);

  // ── Drawing state (teacher only) ───────────────────────────────────────────
  const [tool,         setTool]        = useState("pointer");
  const [color,        setColor]       = useState("#e74c3c");
  const [pageInput,    setPageInput]   = useState("");   // controlled value while editing
  const [editingPage,  setEditingPage] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const pdfCanvasRef        = useRef(null);
  const annotationCanvasRef = useRef(null);
  const renderTaskRef       = useRef(null);
  const renderSeq           = useRef(0);      // only the latest render may touch the canvas
  const fileInputRef        = useRef(null);
  const currentPageRef      = useRef(1);
  const socketRef           = useRef(null);
  const toolRef             = useRef("pointer");
  const colorRef            = useRef("#e74c3c");
  const pdfDocRef           = useRef(null);   // mirrors pdfDoc state for socket callbacks
  const pendingPageRef      = useRef(null);   // page received before PDF was loaded
  const loadPdfRef          = useRef(null);   // stable ref to latest loadPdf callback
  const scaleRef            = useRef(1.3);    // mirrors scale state for socket callbacks
  const annotationSaveTimer = useRef(null);   // debounce timer for saving annotation to DB
  const strokesRef          = useRef({});     // { [page]: [{ id, tool, color, points: [{x, y}] }] } — both sides
  const currentStrokeRef    = useRef(null);   // teacher: stroke being drawn
  const pendingPts          = useRef([]);     // teacher: its points not sent yet
  const sendTimer           = useRef(null);
  const liveAt              = useRef(0);      // student: last live socket update (page/zoom/pen)
  const appliedTs           = useRef({});     // student: { [page]: ts of the DB marks drawn }
  const pendingSave         = useRef(null);   // teacher: page/zoom save not sent yet

  // Keep refs in sync with state
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  const hasPdfRef  = useRef(false);
  const loadingRef = useRef(true);
  useEffect(() => { hasPdfRef.current  = hasPdf;   }, [hasPdf]);
  useEffect(() => { loadingRef.current = loading;  }, [loading]);

  // Free the PDF (pdf.js keeps it in its worker) when it's replaced or we unmount
  useEffect(() => () => { pdfDoc?.destroy?.(); }, [pdfDoc]);

  // ── Pen marks: always drawn from the stroke list ───────────────────────────
  // (They used to be saved as pixels, which came back misplaced after a zoom.)


  const redrawMarks = useCallback((page = currentPageRef.current) => {
    if (page !== currentPageRef.current) return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current[page] || []) drawStrokePart(ctx, canvas, s);
  }, []);

  // ── Socket.IO connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;

    const userName = localStorage.getItem("name") || "User";
    const socket = io(SERVER_URL, {
      auth:       { token: getSocketToken() },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    // (Re)join on every connect — after a network blip the room is gone
    socket.on("connect", () => socket.emit("join-whiteboard", { channelName, userName }));

    if (isTeacher) {
      // When a student joins mid-session, push the current page and zoom so
      // they land on the same view as the teacher immediately.
      socket.on("user-joined", () => {
        if (pdfDocRef.current) {
          socket.emit("pdf-page-sync", { channelName, page: currentPageRef.current });
          socket.emit("pdf-zoom-sync", { channelName, scale: scaleRef.current });
        }
      });
    }

    // ── Student: receive teacher's annotations ─────────────────────────────
    if (!isTeacher) {
      const findStroke = (page, id) => (strokesRef.current[page] || []).find((s) => s.id === id);

      socket.on("pdf-stroke-start", ({ page, id, x, y, strokeTool, strokeColor }) => {
        liveAt.current = Date.now();
        const stroke = { id, tool: strokeTool, color: strokeColor, points: [{ x, y }] };
        (strokesRef.current[page] ||= []).push(stroke);
        const canvas = annotationCanvasRef.current;
        if (canvas && page === currentPageRef.current) drawStrokePart(canvas.getContext("2d"), canvas, stroke);
      });

      socket.on("pdf-stroke-move", ({ page, id, pts }) => {
        liveAt.current = Date.now();
        const stroke = findStroke(page, id);
        if (!stroke || !Array.isArray(pts)) return;
        const from = stroke.points.length;
        for (let i = 0; i + 1 < pts.length; i += 2) stroke.points.push({ x: pts[i], y: pts[i + 1] });
        const canvas = annotationCanvasRef.current;
        if (canvas && page === currentPageRef.current) drawStrokePart(canvas.getContext("2d"), canvas, stroke, from);
      });

      // finished stroke — redraw the page so marker overlaps look like the teacher's
      socket.on("pdf-stroke-end", ({ page }) => {
        liveAt.current = Date.now();
        redrawMarks(page);
      });

      socket.on("pdf-page-sync", ({ page }) => {
        liveAt.current = Date.now();
        // Store so loadPdf can apply the right page if PDF isn't loaded yet.
        pendingPageRef.current = page;
        currentPageRef.current = page;
        setCurrentPage(page); // the render effect draws it
      });

      socket.on("pdf-clear-sync", ({ page }) => {
        liveAt.current = Date.now();
        strokesRef.current[page] = [];
        redrawMarks(page);
      });

      // Teacher uploaded a new PDF — reload it on the student side
      socket.on("pdf-uploaded", () => {
        pendingPageRef.current = null; // new PDF always starts at page 1
        liveAt.current = Date.now();
        setScale(1.3);
        loadPdfRef.current?.({ fresh: true });
      });

      // Teacher changed zoom — follow immediately
      socket.on("pdf-zoom-sync", ({ scale: newScale }) => {
        liveAt.current = Date.now();
        setScale(newScale);
      });
    }

    return () => {
      socket.emit("leave-whiteboard", { channelName });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channelName, isTeacher, redrawMarks]);

  // ── Check for existing PDF on mount ───────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    api.get(`/content/info/${bookingId}`)
      .then(({ data }) => {
        if (data.hasPdf) loadPdf();
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // fresh: a newly uploaded PDF — start at page 1 with no marks. Otherwise the
  // teacher picks up their saved page, zoom and marks (the tab unmounts on
  // every tab switch in the Zoom / Google Meet classrooms).
  const loadPdf = useCallback(async ({ fresh = false } = {}) => {
    try {
      setLoading(true);
      setUploadError(null);
      const [{ data: arrayBuffer }, saved] = await Promise.all([
        api.get(`/content/file/${bookingId}`, { responseType: "arraybuffer" }),
        isTeacher && !fresh
          ? api.get(`/classroom/session/${bookingId}/content-state`, { params: { all: 1 } }).then((r) => r.data).catch(() => null)
          : null,
      ]);
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const strokes = {};
      for (const [page, ann] of Object.entries(saved?.contentAnnotations || {})) {
        if (ann?.data) strokes[page] = parseStrokes(ann.data);
      }
      // If a page sync arrived before the PDF finished loading, jump to that
      // page immediately instead of always resetting to 1.
      const wanted = fresh ? 1 : pendingPageRef.current ?? saved?.contentPage ?? 1;
      const startPage = Math.min(Math.max(1, wanted), doc.numPages);
      pendingPageRef.current = null;
      strokesRef.current = strokes;
      appliedTs.current = {};
      currentPageRef.current = startPage;
      if (saved?.contentScale) setScale(saved.contentScale);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(startPage);
      setHasPdf(true);
    } catch (err) {
      console.error("PDF load error:", err);
      setUploadError(
        err?.response?.data?.message
          ? `Failed to load PDF: ${err.response.data.message}`
          : "Failed to load PDF. Please try uploading again."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, isTeacher]);

  // Keep loadPdfRef pointing at the latest callback so socket listeners
  // (which capture a stale closure) can call it without re-subscribing.
  useEffect(() => { loadPdfRef.current = loadPdf; }, [loadPdf]);

  // ── Render PDF page ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    const seq = ++renderSeq.current;

    (async () => {
      // One render at a time: two overlapping renders into one canvas made
      // pdf.js fail and could leave a blank or mixed page.
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (seq !== renderSeq.current) return;

        const dpr      = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });

        const pdfCanvas = pdfCanvasRef.current;
        if (!pdfCanvas) return;
        pdfCanvas.width  = viewport.width;
        pdfCanvas.height = viewport.height;
        pdfCanvas.style.width  = `${viewport.width  / dpr}px`;
        pdfCanvas.style.height = `${viewport.height / dpr}px`;

        const annCanvas = annotationCanvasRef.current;
        if (annCanvas) {
          annCanvas.width  = viewport.width;
          annCanvas.height = viewport.height;
          annCanvas.style.width  = `${viewport.width  / dpr}px`;
          annCanvas.style.height = `${viewport.height / dpr}px`;
        }
        redrawMarks(currentPage);

        const ctx = pdfCanvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") console.error("Render error:", err);
      } finally {
        if (seq === renderSeq.current) {
          renderTaskRef.current = null;
          setRendering(false);
        }
      }
    })();
  }, [pdfDoc, currentPage, scale, redrawMarks]);

  const goToPage = useCallback((n) => {
    const newPage = Math.max(1, Math.min(n, numPages));
    setCurrentPage(newPage);
  }, [numPages]);

  // ── Teacher: broadcast current page whenever it changes ───────────────────
  useEffect(() => {
    if (!isTeacher || !hasPdf || !channelName || !socketRef.current) return;
    socketRef.current.emit("pdf-page-sync", { channelName, page: currentPage });
  }, [currentPage, isTeacher, hasPdf, channelName]);

  // ── Teacher: broadcast zoom level whenever it changes ─────────────────────
  useEffect(() => {
    if (!isTeacher || !hasPdf || !channelName || !socketRef.current) return;
    socketRef.current.emit("pdf-zoom-sync", { channelName, scale });
  }, [scale, isTeacher, hasPdf, channelName]);

  // ── Teacher: persist page + scale to DB (debounced 600 ms) ────────────────
  // Gives the student poll a reliable source of truth independent of sockets.
  const contentSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!isTeacher || !hasPdf || !bookingId) return;
    const save = () => {
      pendingSave.current = null;
      api.patch(`/classroom/session/${bookingId}/content-state`, { page: currentPage, scale })
        .catch(() => {}); // silent — polling is best-effort
    };
    pendingSave.current = save;
    clearTimeout(contentSaveTimerRef.current);
    contentSaveTimerRef.current = setTimeout(save, 600);
    return () => clearTimeout(contentSaveTimerRef.current);
  }, [currentPage, scale, isTeacher, hasPdf, bookingId]);

  // Leaving the tab within 600 ms of a page change must still save it
  useEffect(() => () => { pendingSave.current?.(); }, []);

  // ── Student: poll content-state every 1.5 s — mirrors page, zoom, annotations ──
  useEffect(() => {
    if (isTeacher || !bookingId) return;
    let timer;
    let stopped = false;

    const poll = async () => {
      try {
        // No PDF loaded yet — check if teacher uploaded one (polling fallback for socket miss)
        if (!hasPdfRef.current) {
          if (!loadingRef.current) {
            const info = await api.get(`/content/info/${bookingId}`).then((r) => r.data).catch(() => null);
            if (info?.hasPdf) loadPdfRef.current?.();
          }
          return;
        }

        const page = currentPageRef.current;
        const { data } = await api.get(`/classroom/session/${bookingId}/content-state`, { params: { page } });
        if (stopped) return;
        // A live update just came in — the DB may not have caught up yet
        if (Date.now() - liveAt.current < LIVE_GRACE_MS) return;

        // ── Page sync ───────────────────────────────────────────────────────
        const pg = data?.contentPage;
        if (pg && pg !== currentPageRef.current) {
          currentPageRef.current = pg;
          setCurrentPage(pg); // the next poll fetches that page's marks
          return;
        }

        // ── Scale sync ──────────────────────────────────────────────────────
        const sc = data?.contentScale;
        if (sc && Math.abs(sc - scaleRef.current) > 0.01) setScale(sc);

        // ── Annotation sync — redraw when the saved marks changed ───────────
        const ann = data?.contentAnnotation;
        if (ann && ann.page === currentPageRef.current && ann.ts !== appliedTs.current[ann.page]) {
          appliedTs.current[ann.page] = ann.ts;
          strokesRef.current[ann.page] = parseStrokes(ann.data);
          redrawMarks(ann.page);
        }
      } catch { /* best-effort — try again next tick */ }
      finally {
        if (!stopped) timer = setTimeout(poll, hasPdfRef.current ? 1500 : 2000);
      }
    };

    timer = setTimeout(poll, 1500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [isTeacher, bookingId, redrawMarks]);

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Please select a PDF file.");
      return;
    }
    try {
      setUploading(true);
      setUploadError(null);
      const form = new FormData();
      form.append("pdf", file);
      await api.post(`/content/upload?bookingId=${bookingId}`, form);
      setScale(1.3);
      await loadPdf({ fresh: true });
      // Notify students that a new PDF is available so they load it too
      if (socketRef.current && channelName) {
        socketRef.current.emit("pdf-uploaded", { channelName });
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Drawing (teacher) ──────────────────────────────────────────────────────
  const getNormPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clamp = (n) => Math.min(1, Math.max(0, n));
    return {
      x: round4(clamp((e.clientX - rect.left) / rect.width)),
      y: round4(clamp((e.clientY - rect.top)  / rect.height)),
    };
  };

  const saveMarks = useCallback((page) => {
    clearTimeout(annotationSaveTimer.current);
    annotationSaveTimer.current = setTimeout(() => {
      const list = (strokesRef.current[page] || []).map(({ tool: t, color: c, points }) => ({ tool: t, color: c, points }));
      api.patch(`/classroom/session/${bookingId}/content-state`, {
        annotation:     JSON.stringify(list),
        annotationPage: page,
      }).catch(() => {});
    }, 300);
  }, [bookingId]);

  const flushPts = useCallback(() => {
    clearTimeout(sendTimer.current);
    sendTimer.current = null;
    const stroke = currentStrokeRef.current;
    if (!stroke || pendingPts.current.length === 0) return;
    socketRef.current?.emit("pdf-stroke-move", { channelName, page: stroke.page, id: stroke.id, pts: pendingPts.current });
    pendingPts.current = [];
  }, [channelName]);

  const startDraw = useCallback((e) => {
    if (!isTeacher || toolRef.current === "pointer") return;
    if (e.button !== 0 || currentStrokeRef.current) return; // left button / one finger only
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep the stroke if the pointer leaves the page
    const norm = getNormPos(e, canvas);
    const page = currentPageRef.current;
    const stroke = { id: newStrokeId(), page, tool: toolRef.current, color: colorRef.current, points: [norm] };
    currentStrokeRef.current = stroke;
    pendingPts.current = [];
    (strokesRef.current[page] ||= []).push(stroke);
    drawStrokePart(canvas.getContext("2d"), canvas, stroke);

    socketRef.current?.emit("pdf-stroke-start", {
      channelName, page, id: stroke.id,
      x: norm.x, y: norm.y,
      strokeTool: stroke.tool, strokeColor: stroke.color,
    });
  }, [isTeacher, channelName]);

  const draw = useCallback((e) => {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const norm = getNormPos(e, canvas);
    const from = stroke.points.length;
    stroke.points.push(norm);
    if (stroke.page === currentPageRef.current) drawStrokePart(canvas.getContext("2d"), canvas, stroke, from);

    pendingPts.current.push(norm.x, norm.y);
    if (pendingPts.current.length >= MAX_BATCH) flushPts();
    else if (!sendTimer.current) sendTimer.current = setTimeout(flushPts, SEND_EVERY_MS);
  }, [flushPts]);

  const stopDraw = useCallback(() => {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    flushPts();
    currentStrokeRef.current = null;
    redrawMarks(stroke.page);
    saveMarks(stroke.page);
    socketRef.current?.emit("pdf-stroke-end", { channelName, page: stroke.page, id: stroke.id });
  }, [channelName, flushPts, redrawMarks, saveMarks]);

  // Switching page mid-stroke ends the stroke on the page it started on
  useEffect(() => { stopDraw(); }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(sendTimer.current); }, []);

  const clearAnnotations = () => {
    if (!isTeacher) return;
    const page = currentPageRef.current;
    strokesRef.current[page] = [];
    redrawMarks(page);
    clearTimeout(annotationSaveTimer.current);
    // Persist cleared state to DB
    if (bookingId) {
      api.patch(`/classroom/session/${bookingId}/content-state`, {
        annotation:     "[]",
        annotationPage: page,
      }).catch(() => {});
    }
    socketRef.current?.emit("pdf-clear-sync", { channelName, page });
  };

  // ── Cursor ─────────────────────────────────────────────────────────────────
  const cursor = !isTeacher ? "default"
    : tool === "eraser"  ? "cell"
    : tool === "pointer" ? "default"
    : "crosshair";

  // ── Loading / empty states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-blue-50">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-10 h-10 text-blue-400 animate-spin" />
          <p className="text-blue-600 font-medium">Loading PDF viewer…</p>
        </div>
      </div>
    );
  }

  if (!hasPdf) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-blue-50 gap-4 p-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
          <Upload className="w-10 h-10 text-blue-500" />
        </div>
        <p className="text-xl font-bold text-blue-700">No PDF loaded</p>
        {isTeacher ? (
          <>
            <p className="text-blue-500 text-sm text-center max-w-xs">
              Upload a PDF to share with your student during this lesson
            </p>
            {uploadError && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{uploadError}</p>
            )}
            <label className="cursor-pointer px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-full shadow-lg transition-all flex items-center gap-2">
              {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading…" : "Upload PDF"}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} disabled={uploading} />
            </label>
          </>
        ) : (
          <p className="text-blue-500 text-sm text-center max-w-xs">
            Waiting for your teacher to upload a PDF for this lesson
          </p>
        )}
      </div>
    );
  }

  // ── Full PDF viewer ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-100">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2 flex flex-wrap items-center gap-2 shadow-sm">

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {isTeacher && (
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || rendering}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-all"
            ><ChevronLeft className="w-4 h-4" /></button>
          )}

          {/* Editable page number — click to type, Enter or blur to jump */}
          <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
            {editingPage && isTeacher ? (
              <input
                autoFocus
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const n = parseInt(pageInput, 10);
                    if (!isNaN(n)) goToPage(n);
                    setEditingPage(false);
                  }
                  if (e.key === "Escape") setEditingPage(false);
                }}
                onBlur={() => {
                  const n = parseInt(pageInput, 10);
                  if (!isNaN(n)) goToPage(n);
                  setEditingPage(false);
                }}
                className="w-10 text-center border border-purple-400 rounded-md px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                style={{ MozAppearance: "textfield" }}
              />
            ) : (
              <span
                onClick={() => { if (isTeacher) { setPageInput(String(currentPage)); setEditingPage(true); } }}
                title={isTeacher ? "Click to jump to page" : undefined}
                className={`min-w-[2rem] text-center px-1 py-0.5 rounded ${isTeacher ? "cursor-pointer hover:bg-purple-100 hover:text-purple-700" : ""}`}
              >
                {currentPage}
              </span>
            )}
            <span className="text-gray-400">/ {numPages}</span>
          </div>

          {isTeacher && (
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages || rendering}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-all"
            ><ChevronRight className="w-4 h-4" /></button>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Zoom — teacher controls zoom; students follow automatically */}
        {isTeacher ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.6, +(s - 0.2).toFixed(1)))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-all">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-600 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-all">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs font-medium text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
        )}

        {/* Teacher-only tools */}
        {isTeacher && (
          <>
            <div className="w-px h-5 bg-gray-200" />

            {/* Drawing tools */}
            <div className="flex items-center gap-1">
              {[
                { id: "pointer",  Icon: MousePointer, label: "Select"  },
                { id: "pen",      Icon: Pencil,       label: "Pen"     },
                { id: "marker",   Icon: Highlighter,  label: "Marker"  },
                { id: "eraser",   Icon: Eraser,       label: "Eraser"  },
              ].map(({ id, Icon, label }) => (
                <button
                  key={id}
                  title={label}
                  onClick={() => setTool(id)}
                  className={`p-1.5 rounded-lg transition-all ${
                    tool === id
                      ? "bg-purple-100 text-purple-700 ring-2 ring-purple-400"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            {/* Colors — only when drawing tool is active */}
            {tool !== "pointer" && tool !== "eraser" && (
              <div className="flex items-center gap-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      color === c ? "border-gray-800 scale-125" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="w-px h-5 bg-gray-200" />

            {/* Clear annotations */}
            <button
              onClick={clearAnnotations}
              title="Clear annotations on this page"
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-200" />

            {/* Replace PDF */}
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all">
              {uploading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Uploading…" : "Replace PDF"}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} disabled={uploading} />
            </label>
          </>
        )}

        {uploadError && (
          <span className="text-red-500 text-xs ml-2">{uploadError}</span>
        )}
      </div>

      {/* ── PDF + Annotation canvas ───────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">
        {rendering && (
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10 }}
            className="bg-white/80 rounded-full p-3 shadow">
            <Loader className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", minWidth: "min-content" }}>
          <div style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
            <canvas ref={pdfCanvasRef} style={{ display: "block" }} />
            <canvas
              ref={annotationCanvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                cursor,
                touchAction: (!isTeacher || tool === "pointer") ? "auto" : "none",
                pointerEvents: isTeacher ? "auto" : "none",
              }}
              onPointerDown={isTeacher ? startDraw : undefined}
              onPointerMove={isTeacher ? draw      : undefined}
              onPointerUp={isTeacher   ? stopDraw  : undefined}
              onPointerCancel={isTeacher ? stopDraw : undefined}
              onLostPointerCapture={isTeacher ? stopDraw : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared helper: configure canvas context for a given tool ──────────────────
// k scales the widths to the page size (see PAGE_UNITS).
function applyStrokeStyle(ctx, strokeTool, strokeColor, k = 1) {
  ctx.lineCap  = "round";
  ctx.lineJoin = "round";
  if (strokeTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 28 * k;
    ctx.globalAlpha = 1;
  } else if (strokeTool === "marker") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 18 * k;
    ctx.globalAlpha = 0.35;
  } else {
    // pen
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 2.5 * k;
    ctx.globalAlpha = 1;
  }
}
