// src/pages/admin/tabs/ParentsTab.jsx
// Admin manages parent accounts: create, link to students, resend invites, delete.
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, RefreshCw, Loader2, Mail, Search, Edit2 } from 'lucide-react';
import api from '../../../api';
import { useTranslation } from "react-i18next";

const F = "'Nunito','Inter',sans-serif";

export default function ParentsTab({ isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const col = {
    card:    'var(--a-surface)',
    border:  'var(--a-line)',
    heading: 'var(--a-ink)',
    body:    'var(--a-ink-2)',
    muted:   'var(--a-muted)',
    accent:  'var(--a-accent-ink)',
    input:   'var(--a-raised)',
  };

  const [parents,       setParents]       = useState([]);
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [msg,           setMsg]           = useState('');
  const [isErr,         setIsErr]         = useState(false);
  const [search,        setSearch]        = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [editParent,    setEditParent]    = useState(null); // null = create, else parent obj
  const [saving,        setSaving]        = useState(false);
  const [resending,     setResending]     = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  const EMPTY = { firstName: '', lastName: '', email: '', phone: '', children: [], notes: '' };
  const [form, setForm] = useState(EMPTY);

  const flash = (m, err = false) => { setMsg(m); setIsErr(err); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/parents'),
        api.get('/students', { params: { limit: 5000 } }),
      ]);
      setParents(pRes.data.parents || []);
      setStudents(sRes.data?.students || sRes.data || []);
    } catch {
      flash(tr("parentsTab.failedToLoadData"), true);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditParent(null); setForm(EMPTY); setStudentSearch(''); setShowModal(true); };
  const openEdit   = (p) => {
    setEditParent(p);
    setForm({
      firstName: p.firstName, lastName: p.lastName, email: p.email,
      phone: p.phone || '', notes: p.notes || '',
      children: (p.children || []).map(c => c._id || c),
    });
    setStudentSearch('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      return flash(tr("parentsTab.firstNameLastNameAnd"), true);
    }
    setSaving(true);
    try {
      if (editParent) {
        await api.patch(`/parents/${editParent._id}`, form);
        flash(tr("parentsTab.parentUpdated"));
      } else {
        await api.post('/parents', form);
        flash(tr("parentsTab.parentCreatedAndInviteSent"));
      }
      setShowModal(false);
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("parentsTab.failedToSave"), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(tr("parentsTab.deactivateSAccount", { firstName: p.firstName, lastName: p.lastName }))) return;
    try {
      await api.delete(`/parents/${p._id}`);
      flash(tr("parentsTab.parentDeactivated"));
      load();
    } catch (e) {
      flash(e.response?.data?.message || tr("parentsTab.failedToDeactivate"), true);
    }
  };

  const handleResend = async (p) => {
    setResending(p._id);
    try {
      await api.post(`/parents/${p._id}/resend-invite`);
      flash(tr("parentsTab.inviteResent"));
    } catch (e) {
      flash(e.response?.data?.message || tr("parentsTab.failedToResendInvite"), true);
    } finally {
      setResending(null);
    }
  };

  const inp = { width: '100%', background: col.input, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body, fontFamily: F, outline: 'none' };
  const btn = (grad, text = '#fff', disabled = false) => ({ background: disabled ? ('var(--a-raised)') : grad, color: disabled ? col.muted : text, border: 'none', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 });

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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>{tr("parentsTab.parents")}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{tr("parentsTab.parentAccount", { parentsCount: parents.length, value: parents.length !== 1 ? 's' : '' })}</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={col.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("parentsTab.searchParents")}
            style={{ ...inp, paddingLeft: 30, width: 210 }} />
        </div>
        <button onClick={load} style={{ ...btn('var(--a-ink)', col.body), padding: '8px 10px' }}><RefreshCw size={14} /></button>
        <button onClick={openCreate} style={btn('var(--a-accent)')}>
          <Plus size={14} /> {tr("parentsTab.addParent")}
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
          <p style={{ color: col.muted, fontWeight: 700 }}>{search ? tr("parentsTab.noMatchingParents") : tr("parentsTab.noParentAccountsYet")}</p>
          {!search && <p style={{ color: col.muted, fontSize: 13 }}>{tr("parentsTab.addAParentToGive")}</p>}
        </div>
      ) : (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 80px 110px', gap: 12, padding: '10px 18px', background: 'var(--a-raised)', borderBottom: `1.5px solid ${col.border}`, fontSize: 11, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>{tr("parentsTab.parent")}</span><span>{tr("parentsTab.email")}</span><span>{tr("parentsTab.children")}</span><span>{tr("parentsTab.status")}</span><span>{tr("parentsTab.actions")}</span>
          </div>
          {filtered.map(p => (
            <div key={p._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 80px 110px', gap: 12, padding: '13px 18px', borderBottom: `1px solid ${col.border}`, alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: col.heading }}>{p.firstName} {p.lastName}</span>
              <span style={{ fontSize: 13, color: col.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(p.children || []).length === 0
                  ? <span style={{ fontSize: 11, color: col.muted }}>{tr("parentsTab.none")}</span>
                  : (p.children || []).map(c => (
                    <span key={c._id || c} style={{ fontSize: 11, fontWeight: 700, background: 'var(--a-accent-soft)', color: col.accent, borderRadius: 999, padding: '2px 8px' }}>
                      {c.firstName || '?'}
                    </span>
                  ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, background: p.status === 'active' ? (isDarkMode ? 'rgba(16,185,129,0.12)' : '#f0fdf4') : (isDarkMode ? 'rgba(202,138,4,0.12)' : '#fefce8'), color: p.status === 'active' ? '#16a34a' : '#ca8a04', borderRadius: 999, padding: '3px 8px', textAlign: 'center' }}>
                {p.status}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(p)} title={tr("parentsTab.edit")} style={{ background: 'none', border: `1px solid ${col.border}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                  <Edit2 size={13} color={col.accent} />
                </button>
                {p.status === 'pending' && (
                  <button onClick={() => handleResend(p)} disabled={resending === p._id} title={tr("parentsTab.resendInvite")}
                    style={{ background: 'none', border: `1px solid ${col.border}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                    {resending === p._id
                      ? <Loader2 size={13} color={col.muted} style={{ animation: 'spin .7s linear infinite' }} />
                      : <Mail size={13} color={col.accent} />}
                  </button>
                )}
                <button onClick={() => handleDelete(p)} title={tr("parentsTab.deactivate")}
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
                {editParent ? tr("parentsTab.editParent") : tr("parentsTab.addParent")}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("parentsTab.firstName")}</label>
                  <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder={tr("parentsTab.nguyen")} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("parentsTab.lastName")}</label>
                  <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder={tr("parentsTab.vanA")} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("parentsTab.emailAddress")}</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder={tr("parentsTab.parentExampleCom")} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("parentsTab.phoneOptional")}</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={{ ...inp, marginTop: 4 }} placeholder="0912 345 678" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                  {tr("parentsTab.linkToStudents")}
                  {form.children.length > 0 && (
                    <span style={{ marginLeft: 8, fontWeight: 700, color: col.accent, textTransform: 'none', letterSpacing: 0 }}>{tr("parentsTab.selected", { childrenCount: form.children.length })}</span>
                  )}
                </label>

                {/* Selected student pills */}
                {form.children.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {form.children.map(id => {
                      const s = students.find(st => st._id === id);
                      if (!s) return null;
                      return (
                        <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--a-accent-grad)', color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          {s.firstName} {s.lastName}
                          <button type="button" onClick={() => toggleChild(id)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, marginTop: 1 }}>
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search input */}
                <div style={{ position: 'relative', marginBottom: 4 }}>
                  <Search size={13} color={col.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder={tr("parentsTab.searchStudents")}
                    style={{ ...inp, paddingLeft: 30 }}
                  />
                </div>

                {/* Scrollable student list */}
                <div style={{ border: `1.5px solid ${col.border}`, borderRadius: 12, maxHeight: 180, overflowY: 'auto', background: col.input }}>
                  {students
                    .filter(s => {
                      if (!studentSearch.trim()) return true;
                      const q = studentSearch.toLowerCase();
                      return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q);
                    })
                    .map(s => {
                      const selected = form.children.includes(s._id);
                      return (
                        <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${col.border}`, background: selected ? ('var(--a-accent-soft)') : 'transparent' }}>
                          <input type="checkbox" checked={selected} onChange={() => toggleChild(s._id)}
                            style={{ width: 15, height: 15, accentColor: col.accent, cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: selected ? 800 : 600, color: selected ? col.accent : col.body }}>
                            {s.firstName} {s.lastName}
                          </span>
                        </label>
                      );
                    })}
                  {students.length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: col.muted }}>{tr("parentsTab.noStudentsFound")}</div>
                  )}
                  {students.length > 0 && studentSearch.trim() && students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: col.muted }}>{tr("parentsTab.noMatchingStudents")}</div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr("parentsTab.notesInternal")}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inp, marginTop: 4, resize: 'vertical' }} placeholder={tr("parentsTab.eGFatherOfMinh")} />
              </div>
            </div>

            {!editParent && (
              <p style={{ fontSize: 12, color: col.muted, marginTop: 14, background: 'var(--a-accent-soft)', border: `1px solid ${'var(--a-accent-line)'}`, borderRadius: 10, padding: '10px 14px' }}>
                {tr("parentsTab.anInviteEmailWillBe")}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={btn('var(--a-ink)', col.body)}>{tr("parentsTab.cancel")}</button>
              <button onClick={handleSave} disabled={saving} style={btn('var(--a-accent)', '#fff', saving)}>
                {saving ? tr("parentsTab.saving") : editParent ? tr("parentsTab.saveChanges") : tr("parentsTab.createSendInvite")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
