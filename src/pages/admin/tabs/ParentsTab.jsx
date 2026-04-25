// src/pages/admin/tabs/ParentsTab.jsx
// Admin manages parent accounts: create, link to students, resend invites, delete.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, RefreshCw, Loader2, Mail, Search, Edit2 } from 'lucide-react';
import api from '../../../api';

const F = "'Nunito','Inter',sans-serif";

export default function ParentsTab({ isDarkMode }) {
  const col = {
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    input:   isDarkMode ? '#0f1117' : '#fff8f0',
  };

  const [parents,    setParents]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState('');
  const [isErr,      setIsErr]      = useState(false);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editParent, setEditParent] = useState(null); // null = create, else parent obj
  const [saving,     setSaving]     = useState(false);
  const [resending,  setResending]  = useState(null);

  const EMPTY = { firstName: '', lastName: '', email: '', phone: '', children: [], notes: '' };
  const [form, setForm] = useState(EMPTY);

  const flash = (m, err = false) => { setMsg(m); setIsErr(err); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/parents'),
        api.get('/students'),
      ]);
      setParents(pRes.data.parents || []);
      setStudents(sRes.data?.students || sRes.data || []);
    } catch {
      flash('Failed to load data', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditParent(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = (p) => {
    setEditParent(p);
    setForm({
      firstName: p.firstName, lastName: p.lastName, email: p.email,
      phone: p.phone || '', notes: p.notes || '',
      children: (p.children || []).map(c => c._id || c),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      return flash('First name, last name, and email are required', true);
    }
    setSaving(true);
    try {
      if (editParent) {
        await api.patch(`/parents/${editParent._id}`, form);
        flash('Parent updated');
      } else {
        await api.post('/parents', form);
        flash('Parent created and invite sent');
      }
      setShowModal(false);
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Deactivate ${p.firstName} ${p.lastName}'s account?`)) return;
    try {
      await api.delete(`/parents/${p._id}`);
      flash('Parent deactivated');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to deactivate', true);
    }
  };

  const handleResend = async (p) => {
    setResending(p._id);
    try {
      await api.post(`/parents/${p._id}/resend-invite`);
      flash('Invite resent');
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to resend invite', true);
    } finally {
      setResending(null);
    }
  };

  const inp = { width: '100%', background: col.input, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body, fontFamily: F, outline: 'none' };
  const btn = (grad, text = '#fff', disabled = false) => ({ background: disabled ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : grad, color: disabled ? col.muted : text, border: 'none', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 });

  const filtered = parents.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q);
  });

  const toggleChild = (id) => {
    setForm(prev => ({
      ...prev,
      children: prev.children.includes(id)
        ? prev.children.filter(c => c !== id)
        : [...prev.children, id],
    }));
  };

  return (
    <div style={{ fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>Parents</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{parents.length} parent account{parents.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={col.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parents…"
            style={{ ...inp, paddingLeft: 30, width: 210 }} />
        </div>
        <button onClick={load} style={{ ...btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body), padding: '8px 10px' }}><RefreshCw size={14} /></button>
        <button onClick={openCreate} style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
          <Plus size={14} /> Add Parent
        </button>
      </div>

      {msg && (
        <div style={{ background: isErr ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${isErr ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: isErr ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center' }}>
          <Users size={40} color={col.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: col.muted, fontWeight: 700 }}>{search ? 'No matching parents' : 'No parent accounts yet'}</p>
          {!search && <p style={{ color: col.muted, fontSize: 13 }}>Add a parent to give them read-only access to their child's progress.</p>}
        </div>
      ) : (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 80px 110px', gap: 12, padding: '10px 18px', background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff8f0', borderBottom: `1.5px solid ${col.border}`, fontSize: 11, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>Parent</span><span>Email</span><span>Children</span><span>Status</span><span>Actions</span>
          </div>
          {filtered.map(p => (
            <div key={p._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 80px 110px', gap: 12, padding: '13px 18px', borderBottom: `1px solid ${col.border}`, alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: col.heading }}>{p.firstName} {p.lastName}</span>
              <span style={{ fontSize: 13, color: col.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(p.children || []).length === 0
                  ? <span style={{ fontSize: 11, color: col.muted }}>None</span>
                  : (p.children || []).map(c => (
                    <span key={c._id || c} style={{ fontSize: 11, fontWeight: 700, background: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed', color: col.accent, borderRadius: 999, padding: '2px 8px' }}>
                      {c.firstName || '?'}
                    </span>
                  ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, background: p.status === 'active' ? (isDarkMode ? 'rgba(16,185,129,0.12)' : '#f0fdf4') : (isDarkMode ? 'rgba(202,138,4,0.12)' : '#fefce8'), color: p.status === 'active' ? '#16a34a' : '#ca8a04', borderRadius: 999, padding: '3px 8px', textAlign: 'center' }}>
                {p.status}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(p)} title="Edit" style={{ background: 'none', border: `1px solid ${col.border}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                  <Edit2 size={13} color={col.accent} />
                </button>
                {p.status === 'pending' && (
                  <button onClick={() => handleResend(p)} disabled={resending === p._id} title="Resend invite"
                    style={{ background: 'none', border: `1px solid ${col.border}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                    {resending === p._id
                      ? <Loader2 size={13} color={col.muted} style={{ animation: 'spin .7s linear infinite' }} />
                      : <Mail size={13} color={col.accent} />}
                  </button>
                )}
                <button onClick={() => handleDelete(p)} title="Deactivate"
                  style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                  <Trash2 size={13} color="#ef4444" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 520, fontFamily: F, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>
                {editParent ? 'Edit Parent' : 'Add Parent'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>First Name *</label>
                  <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder="Nguyen" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Last Name *</label>
                  <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder="Van A" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder="parent@example.com" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Phone (optional)</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder="0912 345 678" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                  Link to Students
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {students.map(s => {
                    const selected = form.children.includes(s._id);
                    return (
                      <button key={s._id} type="button" onClick={() => toggleChild(s._id)}
                        style={{ background: selected ? 'linear-gradient(135deg,#f97316,#f43f5e)' : col.input, color: selected ? '#fff' : col.body, border: `1.5px solid ${selected ? 'transparent' : col.border}`, borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>
                        {s.firstName} {s.lastName}
                      </button>
                    );
                  })}
                  {students.length === 0 && <span style={{ fontSize: 13, color: col.muted }}>No students found</span>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Notes (internal)</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inp, marginTop: 4, resize: 'vertical' }} placeholder="e.g. Father of Minh and Linh" />
              </div>
            </div>

            {!editParent && (
              <p style={{ fontSize: 12, color: col.muted, marginTop: 14, background: isDarkMode ? 'rgba(249,115,22,0.08)' : '#fff7ed', border: `1px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#fed7aa'}`, borderRadius: 10, padding: '10px 14px' }}>
                📧 An invite email will be sent to the parent so they can set their password.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={btn('linear-gradient(135deg,#f97316,#f43f5e)', '#fff', saving)}>
                {saving ? 'Saving…' : editParent ? 'Save Changes' : 'Create & Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
