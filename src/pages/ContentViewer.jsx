// src/pages/ContentViewer.jsx
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
  const [tool,      setTool]      = useState("pointer");
  const [color,     setColor]     = useState("#e74c3c");
  const [isDrawing, setIsDrawing] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const pdfCanvasRef        = useRef(null);
  const annotationCanvasRef = useRef(null);
  const lastPosRef          = useRef(null);
  const renderTaskRef       = useRef(null);
  const annotationsRef      = useRef({}); // { pageNum: ImageData }
  const fileInputRef        = useRef(null);
  const currentPageRef      = useRef(1);
  const socketRef           = useRef(null);
  const isDrawingRef        = useRef(false);
  const toolRef             = useRef("pointer");
  const colorRef            = useRef("#e74c3c");
  const pdfDocRef           = useRef(null);   // mirrors pdfDoc state for socket callbacks
  const pendingPageRef      = useRef(null);   // page received before PDF was loaded
  const loadPdfRef          = useRef(null);   // stable ref to latest loadPdf callback
  const renderPageRef       = useRef(null);   // imperative render fn — called directly by socket (like canvas drawing events)

  // Keep refs in sync with state
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);

  // ── Socket.IO connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;

    const userId   = localStorage.getItem("userId") || "unknown";
    const userName = localStorage.getItem("name")   || "User";

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");
    socketRef.current = socket;

    socket.emit("join-whiteboard", { channelName, userId, userName, userRole });

    if (isTeacher) {
      // When a student joins mid-session, push the current page to them so
      // they land on the same page as the teacher immediately.
      socket.on("user-joined", () => {
        if (pdfDocRef.current && socketRef.current && channelName) {
          socketRef.current.emit("pdf-page-sync", {
            channelName,
            page: currentPageRef.current,
          });
        }
      });
    }

    // ── Student: receive teacher's annotations ─────────────────────────────
    if (!isTeacher) {
      socket.on("pdf-stroke-start", ({ x, y, strokeTool, strokeColor, page }) => {
        if (page !== currentPageRef.current) return;
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        applyStrokeStyle(ctx, strokeTool, strokeColor);
        ctx.beginPath();
        ctx.moveTo(x * canvas.width, y * canvas.height);
      });

      socket.on("pdf-stroke-move", ({ x, y, page }) => {
        if (page !== currentPageRef.current) return;
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.lineTo(x * canvas.width, y * canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x * canvas.width, y * canvas.height);
      });

      socket.on("pdf-stroke-end", ({ page }) => {
        if (page !== currentPageRef.current) return;
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        annotationsRef.current[page] = ctx.getImageData(0, 0, canvas.width, canvas.height);
      });

      socket.on("pdf-page-sync", ({ page }) => {
        // Store so loadPdf can apply the right page if PDF isn't loaded yet.
        pendingPageRef.current = page;

        // Save annotations for the page we're leaving (only if canvas ready).
        const annCanvas = annotationCanvasRef.current;
        if (annCanvas && pdfDocRef.current) {
          const ctx = annCanvas.getContext("2d");
          annotationsRef.current[currentPageRef.current] = ctx.getImageData(
            0, 0, annCanvas.width, annCanvas.height
          );
        }

        // Update the ref immediately so annotation events use the new page.
        currentPageRef.current = page;
        // Update state for the page-counter UI.
        setCurrentPage(page);

        // ── Direct render (same pattern as drawing events) ──────────────────
        // Don't wait for React to re-render + run the useEffect chain.
        // Call the render function directly, exactly like canvas drawing events
        // call ctx.lineTo() directly from the socket handler.
        renderPageRef.current?.(page);
      });

      socket.on("pdf-clear-sync", ({ page }) => {
        if (page !== currentPageRef.current) return;
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        annotationsRef.current[page] = null;
      });

      // Teacher uploaded a new PDF — reload it on the student side
      socket.on("pdf-uploaded", () => {
        pendingPageRef.current = null; // new PDF always starts at page 1
        loadPdfRef.current?.();
      });
    }

    return () => {
      socket.emit("leave-whiteboard", { channelName, userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channelName, isTeacher, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check for existing PDF on mount ───────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    api.get(`/api/content/info/${bookingId}`)
      .then(({ data }) => {
        if (data.hasPdf) loadPdf();
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPdf = useCallback(async () => {
    try {
      setLoading(true);
      setUploadError(null);
      const { data: arrayBuffer } = await api.get(
        `/api/content/file/${bookingId}`,
        { responseType: "arraybuffer" }
      );
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      // If a page sync arrived before the PDF finished loading, jump to that
      // page immediately instead of always resetting to 1.
      const startPage = pendingPageRef.current ?? 1;
      pendingPageRef.current = null;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(startPage);
      setHasPdf(true);
      annotationsRef.current = {};
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
  }, [bookingId]);

  // Keep loadPdfRef pointing at the latest callback so socket listeners
  // (which capture a stale closure) can call it without re-subscribing.
  useEffect(() => { loadPdfRef.current = loadPdf; }, [loadPdf]);

  // ── Render PDF page ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;

    // Build a render function that closes over the latest pdfDoc and scale.
    // We store it in renderPageRef so the student's socket handler can call
    // it directly — the same way drawing events call canvas methods directly —
    // without going through the React state → useEffect chain.
    const doRender = async (pageNum) => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNum);

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

        const ctx = pdfCanvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;

        if (annCanvas && annotationsRef.current[pageNum]) {
          const annCtx = annCanvas.getContext("2d");
          annCtx.putImageData(annotationsRef.current[pageNum], 0, 0);
        }
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") console.error("Render error:", err);
      } finally {
        setRendering(false);
      }
    };

    // Expose to socket handlers before rendering
    renderPageRef.current = doRender;
    doRender(currentPage);
  }, [pdfDoc, currentPage, scale]);

  // ── Save annotations before page change ───────────────────────────────────
  const saveAnnotations = useCallback(() => {
    const annCanvas = annotationCanvasRef.current;
    if (!annCanvas) return;
    const ctx = annCanvas.getContext("2d");
    annotationsRef.current[currentPage] = ctx.getImageData(0, 0, annCanvas.width, annCanvas.height);
  }, [currentPage]);

  const goToPage = useCallback((n) => {
    saveAnnotations();
    const newPage = Math.max(1, Math.min(n, numPages));
    setCurrentPage(newPage);
  }, [saveAnnotations, numPages]);

  // ── Teacher: broadcast current page whenever it changes ───────────────────
  // Using a useEffect (rather than an inline emit inside goToPage) ensures the
  // emit always fires with a fresh ref value — callbacks can capture stale
  // closures, but effects always see the latest render state.
  useEffect(() => {
    if (!isTeacher || !hasPdf || !channelName || !socketRef.current) return;
    socketRef.current.emit("pdf-page-sync", { channelName, page: currentPage });
  }, [currentPage, isTeacher, hasPdf, channelName]);

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
      await api.post(`/api/content/upload?bookingId=${bookingId}`, form);
      await loadPdf();
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

  // ── Drawing helpers ────────────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  };

  // Normalized position (0–1) for socket emission
  const getNormPos = (pos, canvas) => ({
    x: pos.x / canvas.width,
    y: pos.y / canvas.height,
  });

  const startDraw = useCallback((e) => {
    if (!isTeacher || toolRef.current === "pointer") return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    const ctx  = canvas.getContext("2d");

    applyStrokeStyle(ctx, toolRef.current, colorRef.current);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPosRef.current = pos;
    setIsDrawing(true);

    // Emit to students
    if (socketRef.current && channelName) {
      const norm = getNormPos(pos, canvas);
      socketRef.current.emit("pdf-stroke-start", {
        channelName,
        page: currentPageRef.current,
        x: norm.x,
        y: norm.y,
        strokeTool:  toolRef.current,
        strokeColor: colorRef.current,
      });
    }
  }, [isTeacher, channelName]);

  const draw = useCallback((e) => {
    if (!isTeacher || !isDrawingRef.current || toolRef.current === "pointer") return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPosRef.current = pos;

    // Emit to students
    if (socketRef.current && channelName) {
      const norm = getNormPos(pos, canvas);
      socketRef.current.emit("pdf-stroke-move", {
        channelName,
        page: currentPageRef.current,
        x: norm.x,
        y: norm.y,
      });
    }
  }, [isTeacher, channelName]);

  const stopDraw = useCallback(() => {
    if (!isTeacher || !isDrawingRef.current) return;
    const canvas = annotationCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      // Save annotations
      annotationsRef.current[currentPageRef.current] = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    setIsDrawing(false);
    lastPosRef.current = null;

    // Emit to students
    if (socketRef.current && channelName) {
      socketRef.current.emit("pdf-stroke-end", {
        channelName,
        page: currentPageRef.current,
      });
    }
  }, [isTeacher, channelName]);

  const clearAnnotations = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotationsRef.current[currentPage] = null;

    // Emit to students
    if (isTeacher && socketRef.current && channelName) {
      socketRef.current.emit("pdf-clear-sync", {
        channelName,
        page: currentPage,
      });
    }
  };

  // ── Cursor ─────────────────────────────────────────────────────────────────
  const cursor = !isTeacher ? "default"
    : tool === "eraser"  ? "cell"
    : tool === "pointer" ? "default"
    : "crosshair";

  // ── Helper: apply stroke style to context ──────────────────────────────────

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

        {/* Page navigation — teachers can flip pages; students follow automatically */}
        <div className="flex items-center gap-1">
          {isTeacher && (
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || rendering}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-all"
            ><ChevronLeft className="w-4 h-4" /></button>
          )}
          <span className="text-sm font-medium text-gray-700 min-w-[4rem] text-center">
            {currentPage} / {numPages}
          </span>
          {isTeacher && (
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages || rendering}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-all"
            ><ChevronRight className="w-4 h-4" /></button>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Zoom */}
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
              onMouseDown={isTeacher ? startDraw : undefined}
              onMouseMove={isTeacher ? draw    : undefined}
              onMouseUp={isTeacher   ? stopDraw : undefined}
              onMouseLeave={isTeacher ? stopDraw : undefined}
              onTouchStart={isTeacher ? startDraw : undefined}
              onTouchMove={isTeacher  ? draw    : undefined}
              onTouchEnd={isTeacher   ? stopDraw : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared helper: configure canvas context for a given tool ──────────────────
function applyStrokeStyle(ctx, strokeTool, strokeColor) {
  ctx.lineCap  = "round";
  ctx.lineJoin = "round";
  if (strokeTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 28;
    ctx.globalAlpha = 1;
  } else if (strokeTool === "marker") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 18;
    ctx.globalAlpha = 0.35;
  } else {
    // pen
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 1;
  }
}
