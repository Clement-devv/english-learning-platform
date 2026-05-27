// src/components/ring/MissedCalls.jsx
// Shows a missed-calls panel with a badge count. Drop into any dashboard tab.

import { useState, useEffect, useCallback } from "react";
import { PhoneMissed, PhoneOff, X, RefreshCw } from "lucide-react";
import api from "../../api";

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function MissedCalls({ isDark }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [clearing, setClearing] = useState(false);

  const C = {
    bg:     isDark ? "#13151c" : "#f8f9ff",
    card:   isDark ? "#1a1d2e" : "#ffffff",
    border: isDark ? "rgba(255,255,255,0.08)" : "#eef0f8",
    text:   isDark ? "#e8eaf6" : "#1a1d2e",
    sub:    isDark ? "#8b91b8" : "#9ea3be",
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/ring/missed-calls");
      // Response shape (from apiResponse.ok which spreads): { success, incoming, outgoing }
      // — fields live at the top level, NOT under a nested `data` key.
      setIncoming(r.data?.incoming || []);
      setOutgoing(r.data?.outgoing || []);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const clearAll = async () => {
    setClearing(true);
    try {
      await api.delete("/ring/missed-calls");
      setIncoming([]);
      setOutgoing([]);
    } catch { /* ignore */ }
    finally { setClearing(false); }
  };

  const totalMissed = incoming.length;

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <PhoneMissed size={16} color="#ef4444" />
          <span style={{ fontSize: "14px", fontWeight: "800", color: C.text }}>
            Missed Calls
          </span>
          {totalMissed > 0 && (
            <span style={{
              background: "#ef4444", color: "#fff",
              fontSize: "10px", fontWeight: "800",
              borderRadius: "20px", padding: "1px 7px",
            }}>
              {totalMissed}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={fetch} title="Refresh"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, display: "flex", alignItems: "center" }}>
            <RefreshCw size={13} style={loading ? { animation: "ring-spin 0.8s linear infinite" } : {}} />
          </button>
          {totalMissed > 0 && (
            <button onClick={clearAll} disabled={clearing}
              title="Clear all"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.sub, fontSize: "11px", fontWeight: "700",
                display: "flex", alignItems: "center", gap: "3px",
              }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes ring-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Incoming missed */}
      {incoming.length === 0 && outgoing.length === 0 ? (
        <p style={{ fontSize: "12.5px", color: C.sub, margin: 0 }}>No missed calls</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <Section label="Missed (incoming)" items={incoming} type="incoming" isDark={isDark} C={C} />
          )}
          {outgoing.length > 0 && (
            <Section label="No answer (outgoing)" items={outgoing} type="outgoing" isDark={isDark} C={C} />
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, items, type, isDark, C }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <p style={{ margin: "0 0 6px", fontSize: "10.5px", fontWeight: "800",
        textTransform: "uppercase", letterSpacing: "0.07em", color: C.sub }}>
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 10px", borderRadius: "10px",
            background: C.card, border: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
              background: type === "incoming"
                ? (isDark ? "rgba(239,68,68,0.15)" : "#fef2f2")
                : (isDark ? "rgba(245,158,11,0.15)" : "#fffbeb"),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {type === "incoming"
                ? <PhoneMissed size={14} color="#ef4444" />
                : <PhoneOff    size={14} color="#f59e0b" />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "700", color: C.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {type === "incoming" ? item.callerName || "Unknown" : item.targetName || "Unknown"}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: C.sub }}>
                {item.outcome === "declined" ? "Declined" : "No answer"} · {timeAgo(item.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Badge-only export — shows just a red count bubble, useful in nav or tab bar
export function MissedCallsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    api.get("/ring/missed-calls")
      .then(r => setCount((r.data?.incoming || []).length))
      .catch(() => {});
  }, []);

  if (count === 0) return null;
  return (
    <span style={{
      background: "#ef4444", color: "#fff",
      fontSize: "9px", fontWeight: "800",
      borderRadius: "20px", padding: "1px 5px",
      lineHeight: 1.4, minWidth: "16px", textAlign: "center",
    }}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
