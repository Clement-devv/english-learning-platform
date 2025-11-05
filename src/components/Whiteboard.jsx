// src/components/Whiteboard.jsx - Interactive Whiteboard
import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  Download,
  Type,
  Circle,
  Square,
  Minus,
  Undo,
  Redo,
  Maximize2,
  Minimize2
} from 'lucide-react';

export default function Whiteboard({ isMaximized = false, onToggleMaximize }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  const startPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // Restore from history
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

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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

    setIsDrawing(false);
    saveToHistory();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
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
            className={`p-2 rounded-lg transition ${
              tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Pen"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition ${
              tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Eraser"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('line')}
            className={`p-2 rounded-lg transition ${
              tool === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Line"
          >
            <Minus className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('circle')}
            className={`p-2 rounded-lg transition ${
              tool === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Circle"
          >
            <Circle className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('rectangle')}
            className={`p-2 rounded-lg transition ${
              tool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
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
            className="w-24"
            title="Line Width"
          />
          <span className="text-white text-sm">{lineWidth}px</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Colors */}
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 ${
                color === c ? 'border-white scale-110' : 'border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}

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
            className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
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

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
