// src/components/ErrorBoundary.jsx
// Catches JS errors in child component trees.
// Distinguishes network/chunk-load failures from real app crashes so users
// get a helpful "check your connection" prompt instead of a scary error screen.

import { Component } from "react";

// Detects "Failed to fetch dynamically imported module" and similar
// chunk-load errors that happen when the network drops during a lazy import.
function isChunkLoadError(error) {
  if (!error) return false;
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    error.name === "ChunkLoadError"
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retrying: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Only log real app errors, not network blips
    if (!isChunkLoadError(error)) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleRetry() {
    // For chunk errors: clear state and let React re-render (re-triggers the lazy import)
    this.setState({ hasError: false, error: null, retrying: true }, () => {
      this.setState({ retrying: false });
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const chunkError = isChunkLoadError(this.state.error);
    const isDev = import.meta.env.DEV;

    if (chunkError) {
      return (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📶</div>
            <h1 style={styles.title}>Connection issue</h1>
            <p style={styles.body}>
              A page resource couldn't load — this usually happens when your
              internet connection drops briefly.
              <br /><br />
              Check your connection and tap <strong>Retry</strong>.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={this.handleRetry} style={styles.primaryBtn}>
                Retry
              </button>
              <button onClick={() => window.location.reload()} style={styles.secondaryBtn}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Real application error
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={styles.title}>Something went wrong</h1>
          <p style={styles.body}>
            An unexpected error occurred. Please try refreshing the page.
            If the problem persists, contact support.
          </p>

          {isDev && this.state.error && (
            <pre style={styles.devError}>
              {this.state.error.message}
            </pre>
          )}

          <button onClick={() => window.location.reload()} style={styles.primaryBtn}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

const styles = {
  overlay: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
  },
  card: {
    maxWidth: "480px",
    width: "100%",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "40px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    textAlign: "center",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "20px",
    fontWeight: "700",
    color: "#1e293b",
  },
  body: {
    margin: "0 0 24px",
    fontSize: "14px",
    color: "#64748b",
    lineHeight: 1.7,
  },
  primaryBtn: {
    background: "var(--brand-primary, #4f46e5)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 28px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 28px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  devError: {
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
  },
};
