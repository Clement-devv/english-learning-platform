// src/components/ErrorBoundary.jsx
// Catches any JS error in a child component tree and shows a fallback UI
// instead of a blank white screen.

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        padding: "24px",
      }}>
        <div style={{
          maxWidth: "520px",
          width: "100%",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "40px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#1e293b" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
            An unexpected error occurred. Please try refreshing the page.
            If the problem persists, contact support.
          </p>

          {isDev && this.state.error && (
            <pre style={{
              textAlign: "left",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12px",
              color: "#b91c1c",
              overflowX: "auto",
              marginBottom: "24px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--brand-primary, #4f46e5)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 28px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
