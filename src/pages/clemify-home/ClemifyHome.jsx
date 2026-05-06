import React, { useEffect, useRef, useState } from 'react';
import {
  Video, BookOpen, ClipboardList, TrendingUp, Users, Award,
  LayoutDashboard, UserCog, CalendarDays, MessageCircle, Globe, BarChart3,
  UserPlus, Settings, Rocket,
} from 'lucide-react';
import './ClemifyHome.css';

/* ── Floating school-themed SVG decorations ─────────────────────────────────
   Each is a simple line-art shape positioned fixed on the page,
   animated with CSS float keyframes (pointer-events: none).
   They sit between the canvas (-2) and the page content (1+).          */
const DECOS = [
  // { shape, style overrides }
  {
    key: 'book1',
    style: { top: '8vh', left: '4vw', width: 64, animDuration: '5.2s', animDelay: '0s', color: '#f5c842', opacity: 0.18 },
    svg: (
      <svg viewBox="0 0 60 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 47 L2 43 L2 3 L30 9 Z" />
        <path d="M30 47 L58 43 L58 3 L30 9 Z" />
        <path d="M8 16 L27 18 M8 24 L27 26 M8 32 L27 34" />
        <path d="M33 18 L52 16 M33 26 L52 24 M33 34 L52 32" />
      </svg>
    ),
  },
  {
    key: 'cap1',
    style: { top: '12vh', right: '5vw', width: 72, animDuration: '6s', animDelay: '0.8s', color: '#a07fe0', opacity: 0.16 },
    svg: (
      <svg viewBox="0 0 70 55" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 5 L65 20 L35 35 L5 20 Z" />
        <path d="M35 35 L35 47" />
        <path d="M22 42 Q35 50 48 42" />
        <path d="M65 20 L65 33" />
        <circle cx="65" cy="36" r="3" />
      </svg>
    ),
  },
  {
    key: 'student-laptop',
    style: { top: '30vh', left: '2vw', width: 88, animDuration: '7s', animDelay: '1.4s', color: '#4f8ef7', opacity: 0.14 },
    svg: (
      <svg viewBox="0 0 80 70" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="50" x2="72" y2="50" />
        <rect x="12" y="16" width="38" height="28" rx="2" />
        <rect x="8" y="44" width="46" height="6" rx="1" />
        <circle cx="63" cy="33" r="8" />
        <path d="M63 41 L63 58" />
        <path d="M63 58 L53 67 M63 58 L73 67" />
        <path d="M59 49 L42 49" />
      </svg>
    ),
  },
  {
    key: 'student-reading',
    style: { top: '55vh', right: '3vw', width: 76, animDuration: '5.8s', animDelay: '2.2s', color: '#22c55e', opacity: 0.15 },
    svg: (
      <svg viewBox="0 0 60 80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="30" cy="11" r="9" />
        <path d="M30 20 L30 44" />
        <path d="M30 44 L16 58 M30 44 L44 58" />
        <path d="M8 30 L30 36 L52 30 L30 24 Z" />
        <path d="M8 30 L8 42 L30 48 L30 36" />
        <path d="M52 30 L52 42 L30 48" />
        <path d="M26 28 L14 34 M34 28 L46 34" />
      </svg>
    ),
  },
  {
    key: 'pencil1',
    style: { top: '72vh', left: '6vw', width: 28, animDuration: '4.5s', animDelay: '0.5s', color: '#f5c842', opacity: 0.20 },
    svg: (
      <svg viewBox="0 0 30 80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="10" width="14" height="52" rx="2" />
        <path d="M8 10 L15 3 L22 10" />
        <path d="M8 62 L15 72 L22 62" />
        <line x1="8" y1="18" x2="22" y2="18" />
      </svg>
    ),
  },
  {
    key: 'star1',
    style: { top: '20vh', left: '45vw', width: 36, animDuration: '6.5s', animDelay: '3.1s', color: '#f5c842', opacity: 0.15 },
    svg: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 2 L24 15 L38 15 L27 23 L31 37 L20 29 L9 37 L13 23 L2 15 L16 15 Z" />
      </svg>
    ),
  },
  {
    key: 'book2',
    style: { bottom: '18vh', right: '8vw', width: 54, animDuration: '5.5s', animDelay: '1.8s', color: '#38bdf8', opacity: 0.13 },
    svg: (
      <svg viewBox="0 0 60 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 47 L2 43 L2 3 L30 9 Z" />
        <path d="M30 47 L58 43 L58 3 L30 9 Z" />
        <path d="M8 16 L27 18 M8 24 L27 26 M8 32 L27 34" />
        <path d="M33 18 L52 16 M33 26 L52 24 M33 34 L52 32" />
      </svg>
    ),
  },
  {
    key: 'cap2',
    style: { bottom: '10vh', left: '30vw', width: 56, animDuration: '7.2s', animDelay: '4s', color: '#f97316', opacity: 0.12 },
    svg: (
      <svg viewBox="0 0 70 55" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 5 L65 20 L35 35 L5 20 Z" />
        <path d="M35 35 L35 47" />
        <path d="M22 42 Q35 50 48 42" />
        <path d="M65 20 L65 33" />
        <circle cx="65" cy="36" r="3" />
      </svg>
    ),
  },
  {
    key: 'student-laptop2',
    style: { bottom: '28vh', left: '18vw', width: 80, animDuration: '6.8s', animDelay: '2.7s', color: '#a07fe0', opacity: 0.11 },
    svg: (
      <svg viewBox="0 0 80 70" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="50" x2="72" y2="50" />
        <rect x="12" y="16" width="38" height="28" rx="2" />
        <rect x="8" y="44" width="46" height="6" rx="1" />
        <circle cx="63" cy="33" r="8" />
        <path d="M63 41 L63 58" />
        <path d="M63 58 L53 67 M63 58 L73 67" />
        <path d="M59 49 L42 49" />
      </svg>
    ),
  },
  {
    key: 'star2',
    style: { top: '45vh', right: '15vw', width: 28, animDuration: '5s', animDelay: '0.3s', color: '#22c55e', opacity: 0.18 },
    svg: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 2 L24 15 L38 15 L27 23 L31 37 L20 29 L9 37 L13 23 L2 15 L16 15 Z" />
      </svg>
    ),
  },
];

export default function ClemifyHome() {
  const canvasRef  = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({
    name: '', organization: '', email: '', phone: '', service: '', message: '',
  });
  const [formState, setFormState] = useState('idle');
  const [toast, setToast]         = useState(null);

  // ── Navbar scroll tint ──────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Fade-in on scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('ch-visible'); observer.unobserve(e.target); }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );
    document.querySelectorAll('.ch-fade').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ── Canvas: 3 layers + school-shaped floaters ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, animId;
    let streams = [], floaters = [], rings = [];

    const COLORS = ['#f5c842', '#a07fe0', '#4f8ef7', '#22c55e', '#38bdf8', '#f97316', '#ec4899'];
    const WORDS  = [
      'hello', 'learn', 'english', 'speak', 'read', 'write', 'listen', 'teach',
      'student', 'class', 'lesson', 'fluent', 'vocab', 'grammar',
      'tutor', 'school', 'progress', 'skill', 'practice', 'study',
      'achieve', 'grow', 'communicate', 'language', 'pronounce',
    ];
    const SHAPES = ['book', 'cap', 'laptop', 'star', 'pencil', 'student-reading', 'student-laptop', 'book', 'star', 'book'];

    const rndCol  = () => COLORS[Math.floor(Math.random() * COLORS.length)];
    const rndBit  = () => (Math.random() > 0.5 ? '1' : '0');
    const rndWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];
    const rndShape= () => SHAPES[Math.floor(Math.random() * SHAPES.length)];

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();

    // ── Draw school shapes ──────────────────────────────────────────────────
    function drawShape(type, size, alpha, color, rot) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.4;
      ctx.globalAlpha = alpha;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      if (rot) ctx.rotate(rot);

      const s = size;
      if (type === 'book') {
        const w = s, h = s * 0.72;
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(-w/2, h/8); ctx.lineTo(-w/2,-h+h/8); ctx.lineTo(0,-h);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(w/2, h/8); ctx.lineTo(w/2,-h+h/8); ctx.lineTo(0,-h);
        ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = alpha * 0.4;
        for (let i = 1; i <= 3; i++) {
          const ly = -h + h*i/4.6;
          ctx.beginPath(); ctx.moveTo(-w/2+3, ly); ctx.lineTo(-2, ly); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(2, ly);       ctx.lineTo(w/2-3, ly); ctx.stroke();
        }
      } else if (type === 'cap') {
        ctx.beginPath();
        ctx.moveTo(0,-s*0.55); ctx.lineTo(s*0.9,-s*0.18); ctx.lineTo(0,s*0.18); ctx.lineTo(-s*0.9,-s*0.18);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,s*0.18); ctx.lineTo(0,s*0.58); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,s*0.42,s*0.28,0,Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s*0.9,-s*0.18); ctx.lineTo(s*0.9,s*0.18); ctx.stroke();
        ctx.beginPath(); ctx.arc(s*0.9,s*0.22,s*0.1,0,Math.PI*2); ctx.stroke();
      } else if (type === 'laptop') {
        const w = s, h = s * 0.6;
        ctx.strokeRect(-w/2,-h,w,h*0.72);
        ctx.globalAlpha = alpha * 0.35;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-w/2+4,-h+h*0.72*i/4.6); ctx.lineTo(w/2-4,-h+h*0.72*i/4.6);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.strokeRect(-w/2-3,-h*0.28,w+6,h*0.28);
      } else if (type === 'star') {
        const r1 = s*0.5, r2 = s*0.21;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = i*Math.PI/5 - Math.PI/2;
          const r = i%2===0 ? r1 : r2;
          i===0 ? ctx.moveTo(r*Math.cos(angle),r*Math.sin(angle)) : ctx.lineTo(r*Math.cos(angle),r*Math.sin(angle));
        }
        ctx.closePath(); ctx.stroke();
      } else if (type === 'pencil') {
        const h = s, w = s*0.22;
        ctx.rotate(Math.PI/5);
        ctx.strokeRect(-w/2,-h*0.5,w,h*0.72);
        ctx.globalAlpha = alpha*0.45;
        ctx.fillStyle = color;
        ctx.fillRect(-w/2,-h*0.5,w,h*0.1);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(-w/2,h*0.22); ctx.lineTo(w/2,h*0.22); ctx.lineTo(0,h*0.5);
        ctx.closePath(); ctx.stroke();
      } else if (type === 'student-reading') {
        ctx.beginPath(); ctx.arc(0,-s*0.6,s*0.18,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-s*0.42); ctx.lineTo(0,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-s*0.3,s*0.45); ctx.moveTo(0,0); ctx.lineTo(s*0.3,s*0.45); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s*0.4,-s*0.5); ctx.lineTo(-s*0.4,-s*0.1); ctx.lineTo(0,-s*0.16); ctx.lineTo(0,-s*0.5);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0,-s*0.5); ctx.lineTo(0,-s*0.16); ctx.lineTo(s*0.4,-s*0.1); ctx.lineTo(s*0.4,-s*0.5);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s*0.22,-s*0.38); ctx.lineTo(-s*0.4,-s*0.5);
        ctx.moveTo(s*0.22,-s*0.38);  ctx.lineTo(s*0.4,-s*0.5);
        ctx.stroke();
      } else if (type === 'student-laptop') {
        ctx.beginPath(); ctx.arc(s*0.14,-s*0.68,s*0.16,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s*0.14,-s*0.52); ctx.lineTo(s*0.14,-s*0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s*0.14,-s*0.1); ctx.lineTo(-s*0.1,s*0.42); ctx.moveTo(s*0.14,-s*0.1); ctx.lineTo(s*0.34,s*0.42); ctx.stroke();
        ctx.strokeRect(-s*0.48,-s*0.5,s*0.52,s*0.32);
        ctx.strokeRect(-s*0.52,-s*0.18,s*0.6,s*0.1);
        ctx.beginPath(); ctx.moveTo(s*0.1,-s*0.35); ctx.lineTo(-s*0.18,-s*0.22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s*0.6,-s*0.08); ctx.lineTo(s*0.5,-s*0.08); ctx.stroke();
      }
      ctx.restore();
    }

    // ── Layer 1: matrix rain ──────────────────────────────────────────────────
    function newStream(x) {
      return {
        x: x+(Math.random()-0.5)*8, y: Math.random()*-H*1.8,
        speed: 0.5+Math.random()*1.4, fontSize: 11+Math.floor(Math.random()*7),
        color: rndCol(), trail: [], trailLen: 8+Math.floor(Math.random()*22),
        alpha: 0.20+Math.random()*0.42,
      };
    }
    function initStreams() {
      streams=[];
      for (let i=0; i<=Math.floor(W/28); i++) streams.push(newStream(i*28));
    }
    function drawStreams() {
      streams.forEach(s => {
        const lh = s.fontSize*1.35;
        ctx.font = `bold ${s.fontSize}px Consolas,monospace`;
        for (let i=0;i<s.trail.length;i++) {
          ctx.globalAlpha = s.alpha*(1-i/s.trail.length)*0.75;
          ctx.fillStyle=s.color; ctx.fillText(s.trail[i],s.x,s.y-i*lh);
        }
        ctx.globalAlpha=Math.min(s.alpha+0.25,0.95);
        ctx.fillStyle='#fff'; ctx.fillText(rndBit(),s.x,s.y); ctx.globalAlpha=1;
        s.trail.unshift(rndBit());
        if (s.trail.length>s.trailLen) s.trail.pop();
        s.y+=s.speed;
        if (s.y-s.trail.length*lh>H) Object.assign(s,newStream(s.x));
      });
    }

    // ── Layer 2: mixed floaters (words + school shapes) ───────────────────────
    function newFloater(scatter) {
      const depth   = 0.1+Math.random()*0.9;
      const goDown  = Math.random()>0.22;
      const speed   = 0.12+depth*0.75;
      const isShape = Math.random()>0.52;
      return {
        x:       scatter?Math.random()*W:-50+Math.random()*(W+100),
        y:       scatter?Math.random()*H:(goDown?-30:H+30),
        vx:      (Math.random()-0.5)*speed*0.55,
        vy:      (goDown?1:-1)*speed,
        isShape,
        shape:   rndShape(),
        char:    rndWord(),
        color:   rndCol(),
        alpha:   isShape ? 0.05+depth*0.20 : 0.07+depth*0.30,
        size:    isShape ? Math.floor(14+depth*28) : Math.floor(9+depth*16),
        depth,
        tick:    0,
        swapAt:  isShape?99999:40+Math.floor(Math.random()*120),
        rot:     Math.random()*Math.PI*2,
        rotSpd:  (Math.random()-0.5)*0.009,
      };
    }
    function initFloaters() { floaters=[]; for (let i=0;i<55;i++) floaters.push(newFloater(true)); }
    function drawFloaters() {
      floaters.forEach((f,idx) => {
        f.x+=f.vx; f.y+=f.vy; f.tick++;
        if (f.isShape) {
          f.rot+=f.rotSpd;
          ctx.save(); ctx.translate(f.x,f.y);
          drawShape(f.shape,f.size,f.alpha,f.color,f.rot);
          ctx.restore();
        } else {
          if (f.tick>=f.swapAt) { f.char=rndWord(); f.tick=0; f.swapAt=40+Math.floor(Math.random()*120); }
          ctx.save();
          ctx.globalAlpha=f.alpha;
          ctx.font=`${f.size}px Consolas,monospace`;
          ctx.fillStyle=f.color;
          if (f.depth<0.35) ctx.transform(1,0,0.08,1,0,0);
          ctx.fillText(f.char,f.x,f.y);
          ctx.restore();
        }
        const m=160;
        if (f.y>H+m||f.y<-m||f.x<-m||f.x>W+m) floaters[idx]=newFloater(false);
      });
    }

    // ── Layer 3: radial rings ─────────────────────────────────────────────────
    function newRing() {
      return {
        x:Math.random()*W, y:Math.random()*H, r:0,
        maxR:80+Math.random()*140, speed:0.18+Math.random()*0.28,
        color:rndCol(), alpha:0.06+Math.random()*0.08,
      };
    }
    function initRings() {
      rings=[];
      for (let i=0;i<6;i++) { const r=newRing(); r.r=Math.random()*r.maxR; rings.push(r); }
    }
    function drawRings() {
      rings.forEach((ring,idx) => {
        ring.r+=ring.speed;
        ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);
        ctx.strokeStyle=ring.color; ctx.lineWidth=1;
        ctx.globalAlpha=ring.alpha*(1-ring.r/ring.maxR);
        ctx.stroke(); ctx.globalAlpha=1;
        if (ring.r>=ring.maxR) rings[idx]=newRing();
      });
    }

    initStreams(); initFloaters(); initRings();
    const onResize = () => { resize(); initStreams(); };
    window.addEventListener('resize',onResize);

    function animate() {
      ctx.fillStyle='rgba(8,11,26,0.22)';
      ctx.fillRect(0,0,W,H);
      drawRings(); drawStreams(); drawFloaters();
      animId=requestAnimationFrame(animate);
    }
    animate();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize',onResize); };
  }, []);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Form ────────────────────────────────────────────────────────────────────
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      showToast('Please fill in all required fields.', 'error'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showToast('Please enter a valid email address.', 'error'); return;
    }
    setFormState('submitting');
    try {
      const res  = await fetch('/api/v1/public/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setFormState('success');
      } else {
        setFormState('idle');
        showToast(data.message || 'Something went wrong. Try again.', 'error');
      }
    } catch {
      setFormState('idle');
      showToast('Network error. Please try again.', 'error');
    }
  };

  // ── Feature data ────────────────────────────────────────────────────────────
  const studentFeatures = [
    { Icon: Video,          title: 'Live Video Classes',          body: 'Real-time one-on-one and group lessons with teachers via high-quality video and audio.' },
    { Icon: BookOpen,       title: 'Interactive Lesson Content',  body: 'Rich materials, reading exercises, listening tasks, and vocabulary builders — all online.' },
    { Icon: ClipboardList,  title: 'Homework & Assignments',      body: 'Students receive, complete, and submit homework digitally. Teachers review and give instant feedback.' },
    { Icon: TrendingUp,     title: 'Progress Tracking',           body: 'Detailed reports show how each child is growing — visible to both teachers and parents.' },
    { Icon: Users,          title: 'Parent Dashboard',            body: 'Parents stay connected with attendance, report cards, and direct communication channels.' },
    { Icon: Award,          title: 'Achievements & Motivation',   body: 'Built-in systems celebrate milestones and keep children excited about every lesson.' },
  ];

  const adminFeatures = [
    { Icon: LayoutDashboard, title: 'Complete Admin Dashboard',  body: 'Manage teachers, students, classes, and schedules from one powerful control panel.' },
    { Icon: UserCog,         title: 'Teacher Management',        body: 'Onboard teachers, assign classes, track performance, and manage salaries — all in one place.' },
    { Icon: CalendarDays,    title: 'Class Scheduling',          body: 'Create timetables, book sessions, send reminders, and eliminate scheduling conflicts.' },
    { Icon: MessageCircle,   title: 'Real-Time Communication',   body: 'Built-in chat, announcements, and notifications keep your whole school community connected.' },
    { Icon: Globe,           title: 'Your Own School Website',   body: 'Every center gets a professional public page — choose from beautiful templates with your branding.' },
    { Icon: BarChart3,       title: 'Analytics & PDF Reports',   body: 'Visual dashboards, enrollment stats, class summaries, and financial reports — all exportable.' },
  ];

  const steps = [
    { Icon: UserPlus,  num: '01', title: 'Register Your Center',    body: 'Submit a quick request. We review and set up your dedicated school environment within 24 hours.' },
    { Icon: Settings,  num: '02', title: 'We Configure Everything', body: 'Your branded portal, teacher accounts, class structure, and website — all set up and ready to go.' },
    { Icon: Rocket,    num: '03', title: 'Teach, Grow, Succeed',    body: 'Enroll students, schedule classes, go live with video lessons, and watch your school thrive online.' },
  ];

  return (
    <div className="ch-root">
      <canvas ref={canvasRef} className="ch-canvas" />
      <div className="ch-glow" />

      {/* ── CSS-animated floating school decorations ── */}
      {DECOS.map(({ key, style, svg }) => (
        <div
          key={key}
          className="ch-deco"
          style={{
            position: 'fixed',
            color: style.color,
            opacity: style.opacity,
            width: style.width,
            top:    style.top,
            left:   style.left,
            right:  style.right,
            bottom: style.bottom,
            animationDuration:  style.animDuration,
            animationDelay:     style.animDelay,
          }}
        >
          {svg}
        </div>
      ))}

      {/* ════ NAVBAR ════ */}
      <nav className={`ch-nav${scrolled ? ' ch-nav--scrolled' : ''}`}>
        <div className="ch-nav-inner">
          <div className="ch-logo">
            <span className="ch-logo-hex">&#11042;</span>
            <span>Clem<span className="ch-logo-accent">ify</span></span>
          </div>
          <ul className="ch-nav-links">
            <li><a href="#products">Products</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <a href="#contact" className="ch-nav-cta">Get Started</a>
        </div>
      </nav>

      {/* ════ HERO ════ */}
      <section className="ch-hero" id="hero">
        <div className="ch-hero-content">
          <p className="ch-eyebrow">Welcome to Clemify</p>
          <p className="ch-motto">&ldquo;We believe in the happiness of the pursuit&rdquo;</p>
          <h1 className="ch-hero-title">
            The Complete<br />English Learning<br />Platform.
          </h1>
          <p className="ch-hero-desc">
            A full-featured, web-based platform built for English learning centers.
            From interactive student classes to powerful school management tools —
            we handle everything so you can focus on teaching.
          </p>
          <div className="ch-hero-actions">
            <a href="#contact" className="ch-btn-primary">Request a Demo</a>
            <a href="#products" className="ch-btn-ghost">Explore Features</a>
          </div>
        </div>
        <div className="ch-hero-badges">
          <div className="ch-badge ch-badge--student">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            For Students
          </div>
          <div className="ch-badge ch-badge--school">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            For Schools
          </div>
          <div className="ch-badge ch-badge--parent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            For Parents
          </div>
        </div>
      </section>

      {/* ════ PRODUCTS ════ */}
      <section className="ch-section" id="products">
        <div className="ch-container">
          <div className="ch-section-head">
            <span className="ch-tag">What We Offer</span>
            <h2>Built for Every Corner of the Classroom</h2>
            <p>Everything your center needs — designed with children and management in mind.</p>
          </div>

          <div className="ch-product-block ch-fade">
            <p className="ch-product-label">
              <span className="ch-tag ch-tag--blue">For Children &amp; Students</span>
            </p>
            <div className="ch-cards-grid">
              {studentFeatures.map(({ Icon, title, body }, i) => (
                <div className="ch-card" key={i} style={{ transitionDelay: `${i * 0.08}s` }}>
                  <div className="ch-card-icon">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ch-product-block ch-fade" style={{ marginTop: '4rem' }}>
            <p className="ch-product-label">
              <span className="ch-tag ch-tag--gold">For School Owners &amp; Management</span>
            </p>
            <div className="ch-cards-grid">
              {adminFeatures.map(({ Icon, title, body }, i) => (
                <div className="ch-card" key={i} style={{ transitionDelay: `${i * 0.08}s` }}>
                  <div className="ch-card-icon">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section className="ch-section ch-section--alt" id="how-it-works">
        <div className="ch-container">
          <div className="ch-section-head ch-fade">
            <span className="ch-tag">How It Works</span>
            <h2>We Handle Everything Online</h2>
            <p>From setup to day-to-day operations — your platform is live and managed entirely on the web.</p>
          </div>
          <div className="ch-steps ch-fade">
            {steps.map(({ Icon, num, title, body }, i) => (
              <React.Fragment key={i}>
                <div className="ch-step">
                  <div className="ch-step-icon"><Icon size={28} strokeWidth={1.5} /></div>
                  <span className="ch-step-num">{num}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
                {i < 2 && <span className="ch-step-arrow" aria-hidden="true">&#8594;</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ════ ABOUT ════ */}
      <section className="ch-section" id="about">
        <div className="ch-container">
          <div className="ch-section-head">
            <span className="ch-tag">About</span>
            <h2>Who We Are</h2>
          </div>
          <div className="ch-about-body ch-fade">
            <div className="ch-about-text">
              <p>
                Clemify is a web-based English learning platform designed to bring modern education
                technology to every English learning center — regardless of size or location.
              </p>
              <p>
                We built this platform with a simple belief: that great learning tools should be
                accessible to everyone. Whether you run a small neighborhood English school or a
                growing multi-branch academy, Clemify gives you the infrastructure of a world-class
                institution — fully online, fully managed.
              </p>
              <p>
                Our mission is rooted in our motto:{' '}
                <em>&ldquo;We believe in the happiness of the pursuit.&rdquo;</em>{' '}
                Learning is a journey, and we build tools that make that journey joyful —
                for students, teachers, and school owners alike.
              </p>
            </div>
            <div className="ch-about-stats">
              {[
                { num: '100%', label: 'Web-Based' },
                { num: '∞',    label: 'Themes, Your Choice' },
                { num: '∞',    label: 'Students per Center' },
                { num: '24/7', label: 'Platform Access' },
              ].map((s, i) => (
                <div className="ch-stat" key={i}>
                  <span className="ch-stat-num">{s.num}</span>
                  <span className="ch-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ CONTACT ════ */}
      <section className="ch-section ch-section--alt" id="contact">
        <div className="ch-container">
          <div className="ch-section-head">
            <span className="ch-tag">Get In Touch</span>
            <h2>Request Access or Ask a Question</h2>
            <p>Fill in your details and we&apos;ll reach out within 24 hours.</p>
          </div>
          <div className="ch-form-wrapper ch-fade">
            {formState === 'success' ? (
              <div className="ch-success-box">
                <div className="ch-success-icon">&#10003;</div>
                <h3>Request Sent!</h3>
                <p>
                  Thank you for reaching out. We&apos;ll get back to you within 24 hours at{' '}
                  <strong>{formData.email}</strong>.
                </p>
                <button
                  className="ch-btn-primary"
                  onClick={() => {
                    setFormState('idle');
                    setFormData({ name: '', organization: '', email: '', phone: '', service: '', message: '' });
                  }}
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form className="ch-form" onSubmit={handleSubmit} noValidate>
                <div className="ch-form-row">
                  <div className="ch-form-group">
                    <label>Full Name <span className="ch-req">*</span></label>
                    <input type="text" name="name" placeholder="Your full name" value={formData.name} onChange={handleChange} required />
                  </div>
                  <div className="ch-form-group">
                    <label>School / Organization</label>
                    <input type="text" name="organization" placeholder="Your school or organization" value={formData.organization} onChange={handleChange} />
                  </div>
                </div>
                <div className="ch-form-row">
                  <div className="ch-form-group">
                    <label>Email Address <span className="ch-req">*</span></label>
                    <input type="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div className="ch-form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" placeholder="+1 000 000 0000" value={formData.phone} onChange={handleChange} />
                  </div>
                </div>
                <div className="ch-form-group ch-form-group--full">
                  <label>What are you interested in?</label>
                  <select name="service" value={formData.service} onChange={handleChange}>
                    <option value="">— Select an option —</option>
                    <option value="school-setup">Setting up my school on Clemify</option>
                    <option value="demo">Requesting a live demo</option>
                    <option value="pricing">Pricing information</option>
                    <option value="partnership">Partnership inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="ch-form-group ch-form-group--full">
                  <label>Message <span className="ch-req">*</span></label>
                  <textarea
                    name="message" rows={4}
                    placeholder="Tell us about your school and what you're looking for…"
                    value={formData.message} onChange={handleChange} required
                  />
                </div>
                <button type="submit" className="ch-submit-btn" disabled={formState === 'submitting'}>
                  {formState === 'submitting' ? (
                    <span>Sending…</span>
                  ) : (
                    <>
                      <span>Send Request</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer className="ch-footer">
        <div className="ch-container ch-footer-inner">
          <div className="ch-footer-brand">
            <div className="ch-logo">
              <span className="ch-logo-hex">&#11042;</span>
              <span>Clem<span className="ch-logo-accent">ify</span></span>
            </div>
            <p>English Learning Platform</p>
          </div>
          <div className="ch-footer-links">
            <a href="#products">Products</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="mailto:clem.emmy01@gmail.com">clem.emmy01@gmail.com</a>
          </div>
        </div>
        <div className="ch-footer-copy ch-container">
          <p>&#169; 2026 Clemify &mdash; &ldquo;We believe in the happiness of the pursuit&rdquo;</p>
        </div>
      </footer>

      {toast && (
        <div className={`ch-toast ch-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
