// src/pages/teacher/components/classes/ClassModal.jsx
import { useState } from 'react';
import { X, Users, Calendar, Clock, BookOpen, Plus } from 'lucide-react';

const F = "'Nunito','Inter',sans-serif";

// Default theme matches the legacy purple look so the modal still renders
// correctly when a shell forgets to pass one.  Override by passing `theme`.
const DEFAULT_THEME = {
  accent:         '#6366f1',
  accentGradient: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  softBg:         '#eef2ff',
  softBorder:     '#c7d2fe',
  softText:       '#4338ca',
  softBgDark:     'rgba(99,102,241,0.18)',
  softBorderDark: 'rgba(99,102,241,0.3)',
  softTextDark:   '#a5b4fc',
};

export default function ClassModal({ isOpen, onClose, onSave, students, isDarkMode, theme = DEFAULT_THEME }) {
  const [title,            setTitle]            = useState('');
  const [topic,            setTopic]            = useState('');
  const [time,             setTime]             = useState('');
  const [duration,         setDuration]         = useState('60');
  const [selectedStudents, setSelectedStudents] = useState([]);

  if (!isOpen) return null;

  // Merge passed theme over defaults so callers can override only what they need.
  const T = { ...DEFAULT_THEME, ...theme };

  const col = {
    bg:       isDarkMode ? '#0f1117' : '#ffffff',
    card:     isDarkMode ? '#1a1d2e' : '#ffffff',
    header:   isDarkMode ? '#141620' : '#f8faff',
    border:   isDarkMode ? '#2a2d40' : '#e2e8f0',
    heading:  isDarkMode ? '#f0f4ff' : '#1e293b',
    body:     isDarkMode ? '#c8cce0' : '#475569',
    muted:    isDarkMode ? '#6b7090' : '#94a3b8',
    input:    isDarkMode ? '#0f1117' : '#f8faff',
    accent:   T.accent,
    accentBg: isDarkMode ? T.softBgDark : T.softBg,
    selBg:    isDarkMode ? T.softBgDark : T.softBg,
    selBorder:isDarkMode ? T.softBorderDark : T.accent,
    rowHover: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8faff',
    overlay:  'rgba(0,0,0,0.55)',
  };

  const inp = {
    width: '100%', background: col.input, border: `1.5px solid ${col.border}`,
    borderRadius: 12, padding: '10px 14px', fontSize: 14, color: col.heading,
    fontFamily: F, outline: 'none', boxSizing: 'border-box',
    colorScheme: isDarkMode ? 'dark' : 'light',
  };

  const lbl = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 800, color: col.muted,
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
  };

  const handleStudentToggle = (student) => {
    setSelectedStudents(prev => {
      const isSelected = prev.some(s => s.id === student.id);
      return isSelected ? prev.filter(s => s.id !== student.id) : [...prev, student];
    });
  };

  const handleSubmit = () => {
    if (!title || !topic || !time || selectedStudents.length === 0) {
      alert('Please fill in all fields and select at least one student');
      return;
    }
    onSave({
      id: Date.now(), title, topic, time,
      duration: parseInt(duration, 10),
      students: selectedStudents,
      status: 'scheduled',
    });
    setTitle(''); setTopic(''); setTime(''); setDuration('60'); setSelectedStudents([]);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: col.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16, fontFamily: F }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: col.card, border: `1.5px solid ${col.border}`, borderRadius: 24, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ background: T.accentGradient, padding: '22px 24px', borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={22} color="#fff"/>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff' }}>Create New Class</h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', color: '#fff' }}>
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Title */}
          <div>
            <label style={lbl}><BookOpen size={13} color={T.accent}/> Class Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Advanced Grammar Session" style={inp}/>
          </div>

          {/* Topic */}
          <div>
            <label style={lbl}><BookOpen size={13} color="#10b981"/> Topic / Description *</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Past Perfect Tense & Conditionals" style={inp}/>
          </div>

          {/* Date & Time + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}><Calendar size={13} color="#8b5cf6"/> Date & Time *</label>
              <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}><Clock size={13} color="#f97316"/> Duration *</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}
                style={{ ...inp, cursor: 'pointer', appearance: 'auto' }}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>
          </div>

          {/* Students */}
          <div>
            <label style={lbl}><Users size={13} color={T.accent}/> Select Students * ({selectedStudents.length} selected)</label>
            {students && students.length > 0 ? (
              <div style={{ border: `1.5px solid ${col.border}`, borderRadius: 14, padding: 10, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {students.map(student => {
                  const isSelected = selectedStudents.some(s => s.id === student.id);
                  return (
                    <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: isSelected ? col.selBg : 'transparent', border: `1.5px solid ${isSelected ? col.selBorder : 'transparent'}`, transition: 'background .12s' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => handleStudentToggle(student)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: T.accent }}/>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: col.heading }}>{student.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: col.muted }}>{student.email}</p>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: col.accent, background: col.accentBg, borderRadius: 999, padding: '2px 8px' }}>Selected</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8faff', borderRadius: 14, border: `1.5px dashed ${col.border}` }}>
                <Users size={32} color={col.muted} style={{ margin: '0 auto 8px' }}/>
                <p style={{ margin: 0, fontSize: 13, color: col.muted, fontWeight: 600 }}>No students assigned yet</p>
              </div>
            )}
          </div>

          {/* Tip */}
          <div style={{ background: col.accentBg, border: `1.5px solid ${isDarkMode ? T.softBorderDark : T.softBorder}`, borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 12, color: isDarkMode ? T.softTextDark : T.softText, fontWeight: 600 }}>
              <strong>Tip:</strong> You can select multiple students for a group class. All selected students will be scheduled for the same class time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1.5px solid ${col.border}`, background: col.header, borderRadius: '0 0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ background: 'none', border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: col.body, cursor: 'pointer', fontFamily: F }}>
            Cancel
          </button>
          <button onClick={handleSubmit}
            style={{ background: T.accentGradient, border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15}/> Create Class
          </button>
        </div>
      </div>
    </div>
  );
}
