import { useRef, useState } from 'react';
import { motion as Motion, useMotionValue, useMotionTemplate, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowUpRight, Moon, Sun } from 'lucide-react';

export default function TeacherGlassFooter({ onNavigate, dark, onToggleDark, compact = false }) {
  const bounds = useRef(null), [lit, setLit] = useState(false);
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 100, damping: 10, mass: 1 });
  const sy = useSpring(y, { stiffness: 100, damping: 10, mass: 1 });
  const transform = useMotionTemplate`translate3d(${sx}px, ${sy}px, 0)`;
  const enter = event => {
    if (compact || reduced || event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    bounds.current = event.currentTarget.getBoundingClientRect();
    x.jump(event.clientX - bounds.current.left - 85); y.jump(event.clientY - bounds.current.top - 85); setLit(true);
  };
  const move = event => {
    if (!lit || !bounds.current) return;
    x.set(event.clientX - bounds.current.left - 85); y.set(event.clientY - bounds.current.top - 85);
  };
  return <footer className={`tm-glass-footer${compact ? ' tm-glass-footer--compact' : ''}`} onPointerEnter={enter} onPointerMove={move} onPointerLeave={() => setLit(false)}>
    <div className="tm-footer-sculpture" aria-hidden="true" />
    <div className="tm-footer-top"><div className="tm-footer-intro"><span className="tm-eyebrow">MADE FOR YOUR WAY OF TEACHING</span><h2>A little more clarity.<br /><em>A lot more connection.</em></h2><button className="tm-text-button" onClick={() => onNavigate('messages')}>Talk to E.G.O<ArrowUpRight size={15} /></button></div>
      <nav aria-label="Workspace shortcuts"><div><span>YOUR STUDIO</span><button onClick={() => onNavigate('centers')}>My centers</button><button onClick={() => onNavigate('students')}>Students</button><button onClick={() => onNavigate('parent-links')}>Parent links</button><button onClick={() => onNavigate('schedule')}>Schedule</button></div><div><span>YOUR CRAFT</span><button onClick={() => onNavigate('recordings')}>Recordings</button><button onClick={() => onNavigate('homework')}>Homework</button><button onClick={() => onNavigate('resources')}>Teaching library</button></div></nav>
    </div>
    <div className="tm-footer-meta"><span>© {new Date().getFullYear()} Clemify <span className="tm-footer-dot">·</span> Your independent teaching space.</span><button className="tm-appearance" onClick={onToggleDark} aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}>{dark ? <Moon size={13} /> : <Sun size={13} />}{dark ? 'Evening' : 'Daylight'}<span className="tm-toggle-track" aria-hidden="true"><span /></span></button></div>
    <div className="tm-footer-wordmark" aria-hidden="true">E.G.O<span>®</span></div>
    {!compact && !reduced && <Motion.div className="tm-liquid-lens" aria-hidden="true" style={{ transform, opacity: lit ? 1 : 0 }} />}
  </footer>;
}
