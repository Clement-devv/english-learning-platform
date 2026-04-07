/*import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
  
      <App />
    
  </React.StrictMode>,
)*/


/*import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);*/


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { fetchBranding, applyBranding, setCachedBranding } from './utils/branding.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ── Handle impersonation URL params ──────────────────────────────────────────
// Super admin "Enter as Admin" opens a new tab with ?imp_token=xxx&imp_center=slug
const _imp = new URLSearchParams(window.location.search);
const _impToken  = _imp.get('imp_token');
const _impCenter = _imp.get('imp_center');
const _impName   = _imp.get('imp_name');
const _impExp    = _imp.get('imp_exp');
if (_impToken && _impCenter) {
  sessionStorage.setItem('adminToken', _impToken);
  sessionStorage.setItem('adminInfo', JSON.stringify({
    role: 'admin', firstName: 'Viewing', lastName: `(${_impName || _impCenter})`,
    impersonation: true, centerName: _impName || _impCenter,
    centerSlug: _impCenter, expiresAt: _impExp,
  }));
  sessionStorage.setItem('impersonationCenterSlug', _impCenter);
  if (_impExp) sessionStorage.setItem('impersonationExpiresAt', _impExp);
  // Clean URL so the token isn't visible or shareable
  window.history.replaceState({}, '', '/admin');
}
// ─────────────────────────────────────────────────────────────────────────────

// Fetch and apply branding BEFORE rendering React
// If fetch fails, defaults from index.css are already applied
fetchBranding().then(({ branding, center }) => {
  applyBranding(branding, center);
  setCachedBranding(branding, center);
}).catch(() => {
  // Silent fail — defaults apply, app renders normally
}).finally(() => {
  // Always render — branding failure must never block the app
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
