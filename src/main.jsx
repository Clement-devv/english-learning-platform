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
      <App />
    </React.StrictMode>
  );
});
