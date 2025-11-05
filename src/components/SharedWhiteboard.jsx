// src/components/SharedWhiteboard.jsx - WITH INDEPENDENT PDF VISIBILITY CONTROL
import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  Download,
  Circle,
  Square,
  Minus,
  Undo,
  Redo,
  Maximize2,
  Minimize2,
  Users,
  Lock,
  Unlock,
  Upload,
  FileText,
  X,
  Expand,
  Minimize,
  Move,
  Eye,
  EyeOff
} from 'lucide-react';
import io from 'socket.io-client';

let socket = null;

export default function SharedWhiteboard({ 
  isMaximized = false, 
  onToggleMaximize,
  channelName,
  userId,
  userName,
  userRole = 'student'
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [connectedUsers, setConnectedUsers] = useState(1);
  
  // Lock feature
  const [isLocked, setIsLocked] = useState(true);
  const [showLockedMessage, setShowLockedMessage] = useState(false);
  
  // PDF viewer
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  
  // NEW: PDF visibility control (teacher decides if students can see PDF)
  const [pdfVisibleToStudents, setPdfVisibleToStudents] = useState(false);
  
  // Resizable panels
  const [whiteboardWidth, setWhiteboardWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  
  // Fullscreen modes
  const [viewMode, setViewMode] = useState('normal');
  
  const startPointRef = useRef({ x: 0, y: 0 });

  // Initialize Socket.IO
  useEffect(() => {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      query: { channelName, userId, userName, userRole }
    });

    socket.emit('join-whiteboard', { channelName, userId, userName, userRole });

    socket.on('drawing', handleRemoteDrawing);
    socket.on('clear-canvas', handleRemoteClear);
    socket.on('user-count', (count) => setConnectedUsers(count));
    socket.on('lock-status', handleLockStatusChange);
    socket.on('pdf-shared', handlePdfShared);
    socket.on('pdf-removed', handlePdfRemoved);
    socket.on('pdf-visibility-changed', handlePdfVisibilityChanged); // NEW

    return () => {
      socket.emit('leave-whiteboard', { channelName, userId });
      socket.off('drawing');
      socket.off('clear-canvas');
      socket.off('user-count');
      socket.off('lock-status');
      socket.off('pdf-shared');
      socket.off('pdf-removed');
      socket.off('pdf-visibility-changed');
      socket.disconnect();
    };
  }, [channelName, userId, userName, userRole]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      if (history[historyStep]) {
        const img = new Image();
        img.src = history[historyStep];
        img.onload = () => ctx.drawImage(img, 0, 0);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [history, historyStep]);

  // Handle dragging divider
  const handleMouseDown = (e) => {
    if (shouldShowPdfPanel() && viewMode === 'normal') {
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      
      const newWidth = Math.min(Math.max(percentage, 20), 80);
      setWhiteboardWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleLockStatusChange = (locked) => {
    setIsLocked(locked);
  };

  // NEW: Handle PDF visibility changes
  const handlePdfVisibilityChanged = (visible) => {
    setPdfVisibleToStudents(visible);
    console.log(`📄 PDF visibility changed: ${visible ? 'Students CAN see' : 'Students CANNOT see'}`);
  };

  // NEW: Determine if current user should see PDF panel
  const shouldShowPdfPanel = () => {
    if (!pdfUrl) return false;
    if (userRole === 'teacher') return showPdfViewer; // Teacher always controls their own view
    return showPdfViewer && pdfVisibleToStudents; // Students only if teacher enabled
  };

  const toggleLock = () => {
    if (userRole !== 'teacher') return;
    const newLockStatus = !isLocked;
    setIsLocked(newLockStatus);
    socket.emit('toggle-lock', { channelName, locked: newLockStatus });
  };

  // NEW: Toggle PDF visibility for students (teacher only)
  const togglePdfVisibilityForStudents = () => {
    if (userRole !== 'teacher') return;
    
    const newVisibility = !pdfVisibleToStudents;
    setPdfVisibleToStudents(newVisibility);
    
    // Broadcast to all students
    socket.emit('toggle-pdf-visibility', { 
      channelName, 
      visible: newVisibility 
    });
    
    console.log(`👁️ PDF ${newVisibility ? 'SHOWN' : 'HIDDEN'} for students`);
  };

  const canDraw = () => {
    if (userRole === 'teacher') return true;
    if (!isLocked) return true;
    setShowLockedMessage(true);
    setTimeout(() => setShowLockedMessage(false), 2000);
    return false;
  };

  // PDF Handling
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      setPdfUrl(base64);
      setShowPdfViewer(true);
      setPdfVisibleToStudents(false); // Default: hidden from students
      
      socket.emit('share-pdf', {
        channelName,
        pdfData: base64,
        fileName: file.name,
        sharedBy: userName,
        visibleToStudents: false // Start hidden
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePdfShared = ({ pdfData, fileName, sharedBy, visibleToStudents }) => {
    setPdfUrl(pdfData);
    
    // Teacher always sees it, students only if enabled
    if (userRole === 'teacher') {
      setShowPdfViewer(true);
    } else {
      setShowPdfViewer(visibleToStudents);
    }
    
    setPdfVisibleToStudents(visibleToStudents);
  };

  const handlePdfRemoved = () => {
    setPdfUrl(null);
    setShowPdfViewer(false);
    setPdfVisibleToStudents(false);
    setViewMode('normal');
  };

  const removePdf = () => {
    setPdfUrl(null);
    setShowPdfViewer(false);
    setPdfVisibleToStudents(false);
    setViewMode('normal');
    socket.emit('remove-pdf', { channelName });
  };

  // View mode functions
  const toggleWhiteboardFullscreen = () => {
    if (viewMode === 'whiteboard-full') {
      setViewMode('normal');
    } else {
      setViewMode('whiteboard-full');
    }
  };

  const togglePdfFullscreen = () => {
    if (viewMode === 'pdf-full') {
      setViewMode('normal');
    } else {
      setViewMode('pdf-full');
    }
  };

  const handleRemoteDrawing = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    ctx.strokeStyle = data.tool === 'eraser' ? '#ffffff' : data.color;
    ctx.lineWidth = data.tool === 'eraser' ? data.lineWidth * 3 : data.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (data.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'draw') {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    } else if (data.type === 'end') {
      if (data.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(data.startX, data.startY);
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      } else if (data.tool === 'circle') {
        const radius = Math.sqrt(
          Math.pow(data.x - data.startX, 2) + 
          Math.pow(data.y - data.startY, 2)
        );
        ctx.beginPath();
        ctx.arc(data.startX, data.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (data.tool === 'rectangle') {
        const width = data.x - data.startX;
        const height = data.y - data.startY;
        ctx.beginPath();
        ctx.rect(data.startX, data.startY, width, height);
        ctx.stroke();
      }
    }
  };

  const handleRemoteClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const startDrawing = (e) => {
    if (!canDraw()) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    startPointRef.current = { x, y };
    setIsDrawing(true);

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    socket.emit('drawing', {
      channelName, userId, type: 'start', tool, color, lineWidth, x, y
    });
  };

  const draw = (e) => {
    if (!isDrawing || !canDraw()) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();

      socket.emit('drawing', {
        channelName, userId, type: 'draw', tool, color, lineWidth, x, y
      });
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');

    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startPointRef.current.x, startPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(x - startPointRef.current.x, 2) + 
        Math.pow(y - startPointRef.current.y, 2)
      );
      ctx.beginPath();
      ctx.arc(startPointRef.current.x, startPointRef.current.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      const width = x - startPointRef.current.x;
      const height = y - startPointRef.current.y;
      ctx.beginPath();
      ctx.rect(startPointRef.current.x, startPointRef.current.y, width, height);
      ctx.stroke();
    }

    socket.emit('drawing', {
      channelName, userId, type: 'end', tool, color, lineWidth, x, y,
      startX: startPointRef.current.x, startY: startPointRef.current.y
    });

    setIsDrawing(false);
    saveToHistory();
  };

  const clearCanvas = () => {
    if (!canDraw()) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();

    socket.emit('clear-canvas', { channelName, userId });
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${channelName}-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = history[historyStep - 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = history[historyStep + 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="bg-gray-800 p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Drawing Tools */}
          <button
            onClick={() => setTool('pen')}
            disabled={userRole === 'student' && isLocked}
            className={`p-2 rounded-lg transition ${
              tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Pen"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('eraser')}
            disabled={userRole === 'student' && isLocked}
            className={`p-2 rounded-lg transition ${
              tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Eraser"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('line')}
            disabled={userRole === 'student' && isLocked}
            className={`p-2 rounded-lg transition ${
              tool === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Line"
          >
            <Minus className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('circle')}
            disabled={userRole === 'student' && isLocked}
            className={`p-2 rounded-lg transition ${
              tool === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Circle"
          >
            <Circle className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('rectangle')}
            disabled={userRole === 'student' && isLocked}
            className={`p-2 rounded-lg transition ${
              tool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Rectangle"
          >
            <Square className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-600 mx-2" />

          {/* Line Width */}
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            disabled={userRole === 'student' && isLocked}
            className="w-24"
            title="Line Width"
          />
          <span className="text-white text-sm">{lineWidth}px</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Colors */}
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              disabled={userRole === 'student' && isLocked}
              className={`w-8 h-8 rounded-full border-2 ${
                color === c ? 'border-white scale-110' : 'border-gray-600'
              } ${userRole === 'student' && isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}

          <div className="w-px h-8 bg-gray-600 mx-2" />

          {/* Lock/Unlock - Teacher Only */}
          {userRole === 'teacher' && (
            <>
              <button
                onClick={toggleLock}
                className={`p-2 rounded-lg transition ${
                  isLocked 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                title={isLocked ? 'Unlock for Students' : 'Lock for Students'}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </button>
              <div className="w-px h-8 bg-gray-600 mx-2" />
            </>
          )}

          {/* PDF Controls - Teacher Only */}
          {userRole === 'teacher' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition"
                title="Upload & Share PDF"
              >
                <Upload className="w-5 h-5" />
              </button>
              
              {pdfUrl && (
                <>
                  {/* NEW: PDF Visibility Toggle for Students */}
                  <button
                    onClick={togglePdfVisibilityForStudents}
                    className={`p-2 rounded-lg transition ${
                      pdfVisibleToStudents
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                    title={pdfVisibleToStudents ? 'Students CAN see PDF (Click to hide)' : 'Students CANNOT see PDF (Click to show)'}
                  >
                    {pdfVisibleToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
                    className={`p-2 rounded-lg transition ${
                      showPdfViewer 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={showPdfViewer ? 'Hide PDF (for me)' : 'Show PDF (for me)'}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={removePdf}
                    className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
                    title="Remove PDF (for everyone)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              )}
              <div className="w-px h-8 bg-gray-600 mx-2" />
            </>
          )}

          {/* Student PDF Indicator */}
          {userRole === 'student' && pdfUrl && (
            <>
              {pdfVisibleToStudents ? (
                <button
                  onClick={() => setShowPdfViewer(!showPdfViewer)}
                  className={`p-2 rounded-lg transition ${
                    showPdfViewer 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={showPdfViewer ? 'Hide PDF' : 'Show PDF'}
                >
                  <FileText className="w-5 h-5" />
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm">
                  <EyeOff className="w-4 h-4" />
                  <span>PDF Hidden by Teacher</span>
                </div>
              )}
              <div className="w-px h-8 bg-gray-600 mx-2" />
            </>
          )}

          {/* Connected Users */}
          <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{connectedUsers}</span>
          </div>

          <div className="w-px h-8 bg-gray-600 mx-2" />

          {/* Actions */}
          <button
            onClick={undo}
            disabled={historyStep <= 0}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>

          <button
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo className="w-5 h-5" />
          </button>

          <button
            onClick={clearCanvas}
            disabled={userRole === 'student' && isLocked}
            className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            onClick={downloadCanvas}
            className="p-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>

          {onToggleMaximize && (
            <>
              <div className="w-px h-8 bg-gray-600 mx-2" />
              <button
                onClick={onToggleMaximize}
                className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas & PDF Viewer with Resizable Panels */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-white flex">
        {/* Whiteboard Panel */}
        <div 
          className={`relative transition-all ${
            viewMode === 'normal' && shouldShowPdfPanel()
              ? '' 
              : viewMode === 'pdf-full' 
                ? 'hidden' 
                : 'w-full'
          }`}
          style={{
            width: viewMode === 'normal' && shouldShowPdfPanel()
              ? `${whiteboardWidth}%` 
              : '100%'
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className={`w-full h-full ${userRole === 'student' && isLocked ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
            style={{ touchAction: 'none' }}
          />
          
          {/* Live Indicator */}
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
            <span className="text-sm font-medium">Live Shared</span>
          </div>

          {/* Lock Status for Students */}
          {userRole === 'student' && isLocked && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">Locked by Teacher</span>
            </div>
          )}

          {/* Whiteboard Fullscreen Toggle */}
          {shouldShowPdfPanel() && (
            <button
              onClick={toggleWhiteboardFullscreen}
              className="absolute top-4 right-4 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-lg transition"
              title={viewMode === 'whiteboard-full' ? 'Return to Split View' : 'Fullscreen Whiteboard'}
            >
              {viewMode === 'whiteboard-full' ? <Minimize className="w-5 h-5" /> : <Expand className="w-5 h-5" />}
            </button>
          )}

          {/* Locked Message */}
          {showLockedMessage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-2xl animate-bounce">
                <Lock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold">Whiteboard is Locked!</p>
                <p className="text-sm">Teacher needs to unlock it first</p>
              </div>
            </div>
          )}
        </div>

        {/* Draggable Divider */}
        {shouldShowPdfPanel() && viewMode === 'normal' && (
          <div
            onMouseDown={handleMouseDown}
            className="w-2 bg-gray-400 hover:bg-blue-500 cursor-col-resize flex items-center justify-center group relative"
            title="Drag to resize panels"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Move className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
            </div>
            {isDragging && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-blue-500" />
            )}
          </div>
        )}

        {/* PDF Viewer Panel */}
        {shouldShowPdfPanel() && viewMode !== 'whiteboard-full' && (
          <div 
            className={`relative bg-gray-100 border-l-2 border-gray-300 flex flex-col transition-all ${
              viewMode === 'pdf-full' ? 'w-full' : ''
            }`}
            style={{
              width: viewMode === 'normal' 
                ? `${100 - whiteboardWidth}%` 
                : '100%'
            }}
          >
            <div className="bg-gray-800 text-white p-2 flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                📄 Shared PDF
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePdfFullscreen}
                  className="p-1 hover:bg-gray-700 rounded transition"
                  title={viewMode === 'pdf-full' ? 'Return to Split View' : 'Fullscreen PDF'}
                >
                  {viewMode === 'pdf-full' ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowPdfViewer(false)}
                  className="p-1 hover:bg-gray-700 rounded transition"
                  title="Hide PDF"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0 rounded-lg shadow-lg"
                title="Shared PDF Document"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
