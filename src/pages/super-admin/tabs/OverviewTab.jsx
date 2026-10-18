// src/pages/super-admin/tabs/OverviewTab.jsx
// Super admin landing page: the numbers that matter, what needs a decision now
// (pending centers, expiring invites, suspended centers, domains waiting for DNS),
// plan mix, newest centers and quick actions. Every row opens the center's Manage panel.
import { useMemo, useState } from 'react';
import {
  Building2, Clock, PauseCircle, HeartPulse, Globe, Check, X, ChevronRight, Plus, Megaphone, Search, Send, Sparkles,
} from 'lucide-react';

const PLANS = [
  { key: 'free', label: 'Free', color: '#94a3b8' },
  { key: 'basic', label: 'Basic', color: '#60a5fa' },
  { key: 'pro', label: 'Pro', color: '#6366f1' },
  { key: 'enterprise', label: 'Enterprise', color: '#0f766e' },
];
const STATUS = { active: '#16a34a', pending: '#d97706', suspended: '#dc2626', rejected: '#64748b' };
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const ago = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 864e5);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(d).toLocaleDateString();
};
const inDays = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5);

function Mark({ name }) {
  return <span className="sa2-cmd-mark" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 12 }}>{initials(name)}</span>;
}

export default function OverviewTab({ centers = [], domains = [], monitorBadge = 0, onOpenCenter, onTab, onApprove, onReject, onCreate, onBroadcast, onSearch }) {
  const [busy, setBusy] = useState(null);
  const by = useMemo(() => {
    const g = { active: [], pending: [], suspended: [], rejected: [] };
    for (const c of centers) (g[c.status] || (g[c.status] = [])).push(c);
    return g;
  }, [centers]);
  const invited = by.pending.filter((c) => c.invite?.expiresAt);
  const toApprove = by.pending.filter((c) => !c.invite?.expiresAt);
  const dnsWaiting = domains.filter((d) => !d.domainVerified);
  const newest = [...by.active].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const planCounts = PLANS.map((p) => ({ ...p, n: by.active.filter((c) => (c.plan || 'basic') === p.key).length }));
  const activeTotal = by.active.length || 1;

  const act = async (fn, c) => { setBusy(c._id); try { await fn(c._id); } finally { setBusy(null); } };
  const attention = toApprove.length + invited.filter((c) => inDays(c.invite.expiresAt) <= 2).length + by.suspended.length + dnsWaiting.length;

  return (
    <div>
      {/* KPIs — each opens the page where you act on it */}
      <div className="sa2-kpis">
        <button type="button" className="sa2-kpi" onClick={() => onTab('centers')}>
          <span className="sa2-kpi-label"><Building2 size={15} /> Active centers</span>
          <div className="sa2-kpi-value">{by.active.length}</div>
          <div className="sa2-kpi-sub">{centers.length} in total</div>
        </button>
        <button type="button" className="sa2-kpi" onClick={() => onTab('centers')}>
          <span className="sa2-kpi-label"><Clock size={15} color="#d97706" /> Waiting for you</span>
          <div className="sa2-kpi-value">{by.pending.length}</div>
          <div className="sa2-kpi-sub">{toApprove.length} to approve · {invited.length} invited</div>
        </button>
        <button type="button" className="sa2-kpi" onClick={() => onTab('centers')}>
          <span className="sa2-kpi-label"><PauseCircle size={15} color={by.suspended.length ? '#dc2626' : undefined} /> Suspended</span>
          <div className="sa2-kpi-value">{by.suspended.length}</div>
          <div className="sa2-kpi-sub">{by.rejected.length} rejected</div>
        </button>
        <button type="button" className="sa2-kpi" onClick={() => onTab('monitor')}>
          <span className="sa2-kpi-label"><HeartPulse size={15} color={monitorBadge ? '#dc2626' : '#16a34a'} /> App health</span>
          <div className="sa2-kpi-value" style={{ color: monitorBadge ? '#dc2626' : undefined }}>{monitorBadge ? monitorBadge : 'OK'}</div>
          <div className="sa2-kpi-sub">{monitorBadge ? `problem${monitorBadge === 1 ? '' : 's'} right now` : 'All checks passing'}</div>
        </button>
      </div>

      <div className="sa2-grid">
        <div>
          {/* Needs attention */}
          <section className="sa2-panel" aria-labelledby="sa2-att">
            <div className="sa2-panel-h">
              <h2 id="sa2-att">Needs your attention {attention > 0 && <span className="sa2-count sa2-count--warn">{attention}</span>}</h2>
              <button type="button" className="sa2-link" onClick={() => onTab('centers')}>All centers <ChevronRight size={14} /></button>
            </div>
            {attention === 0 && <div className="sa2-empty"><Sparkles size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />All caught up — nothing waiting for a decision.</div>}

            {toApprove.map((c) => (
              <div className="sa2-row" key={c._id}>
                <button type="button" className="sa2-row-btn" onClick={() => onOpenCenter(c)}>
                  <Mark name={c.centerName} />
                  <span className="sa2-row-main"><b>{c.centerName}</b><small>Registered {ago(c.createdAt)} · {c.adminEmail}</small></span>
                </button>
                <span className="sa2-pill" style={{ '--c': STATUS.pending }}>Pending</span>
                <button type="button" className="sa2-btn sa2-btn--sm sa2-btn--ok" disabled={busy === c._id} onClick={() => act(onApprove, c)}><Check size={14} /> Approve</button>
                <button type="button" className="sa2-btn sa2-btn--sm sa2-btn--danger" disabled={busy === c._id} onClick={() => act(onReject, c)} aria-label={`Reject ${c.centerName}`}><X size={14} /></button>
              </div>
            ))}
            {invited.filter((c) => inDays(c.invite.expiresAt) <= 2).map((c) => (
              <div className="sa2-row" key={c._id}>
                <button type="button" className="sa2-row-btn" onClick={() => onOpenCenter(c)}>
                  <Mark name={c.centerName} />
                  <span className="sa2-row-main"><b>{c.centerName}</b><small>Invite {inDays(c.invite.expiresAt) <= 0 ? 'expired' : `expires in ${inDays(c.invite.expiresAt)} day${inDays(c.invite.expiresAt) === 1 ? '' : 's'}`} · not accepted yet</small></span>
                </button>
                <span className="sa2-pill" style={{ '--c': '#2563eb' }}>Invited</span>
                <button type="button" className="sa2-btn sa2-btn--sm" onClick={() => onOpenCenter(c)}><Send size={13} /> Resend</button>
              </div>
            ))}
            {by.suspended.map((c) => (
              <div className="sa2-row" key={c._id}>
                <button type="button" className="sa2-row-btn" onClick={() => onOpenCenter(c)}>
                  <Mark name={c.centerName} />
                  <span className="sa2-row-main"><b>{c.centerName}</b><small>Suspended — its people can't sign in</small></span>
                </button>
                <span className="sa2-pill" style={{ '--c': STATUS.suspended }}>Suspended</span>
                <button type="button" className="sa2-btn sa2-btn--sm" onClick={() => onOpenCenter(c)}>Manage</button>
              </div>
            ))}
            {dnsWaiting.map((d) => (
              <div className="sa2-row" key={`d-${d._id}`}>
                <button type="button" className="sa2-row-btn" onClick={() => onTab('domains')}>
                  <span className="sa2-cmd-mark" style={{ width: 32, height: 32, borderRadius: 9 }}><Globe size={15} /></span>
                  <span className="sa2-row-main"><b>{d.customDomain}</b><small>{d.centerName} · waiting for DNS check</small></span>
                </button>
                <button type="button" className="sa2-btn sa2-btn--sm" onClick={() => onTab('domains')}>Verify</button>
              </div>
            ))}
          </section>

          {/* Newest centers */}
          <section className="sa2-panel" aria-labelledby="sa2-new">
            <div className="sa2-panel-h"><h2 id="sa2-new">Newest centers</h2></div>
            {newest.length === 0 && <div className="sa2-empty">No active centers yet.</div>}
            {newest.map((c) => (
              <div className="sa2-row" key={c._id}>
                <button type="button" className="sa2-row-btn" onClick={() => onOpenCenter(c)}>
                  <Mark name={c.centerName} />
                  <span className="sa2-row-main"><b>{c.centerName}</b><small>{c.slug} · joined {ago(c.createdAt)}</small></span>
                </button>
                <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--sa-text-2)', textTransform: 'capitalize' }}>{c.plan || 'basic'}</span>
                <ChevronRight size={16} color="var(--sa-muted)" />
              </div>
            ))}
          </section>
        </div>

        <div>
          <section className="sa2-panel" aria-labelledby="sa2-qa">
            <div className="sa2-panel-h"><h2 id="sa2-qa">Quick actions</h2></div>
            <div className="sa2-actions">
              <button type="button" className="sa2-action" onClick={onCreate}><Plus size={16} /> Create center</button>
              <button type="button" className="sa2-action" onClick={onSearch}><Search size={16} /> Find a center</button>
              <button type="button" className="sa2-action" onClick={onBroadcast}><Send size={16} /> Email centers</button>
              <button type="button" className="sa2-action" onClick={() => onTab('board')}><Megaphone size={16} /> Board message</button>
            </div>
          </section>

          <section className="sa2-panel" aria-labelledby="sa2-plan">
            <div className="sa2-panel-h"><h2 id="sa2-plan">Plans</h2><span style={{ fontSize: 12, color: 'var(--sa-muted)' }}>{by.active.length} active centers</span></div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div className="sa2-bar" role="img" aria-label={planCounts.map((p) => `${p.label} ${p.n}`).join(', ')}>
                {planCounts.filter((p) => p.n).map((p) => <span key={p.key} style={{ width: `${(p.n / activeTotal) * 100}%`, background: p.color }} />)}
              </div>
              <div className="sa2-legend">
                {planCounts.map((p) => <div key={p.key}><i style={{ background: p.color }} />{p.label}<b>{p.n}</b></div>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
