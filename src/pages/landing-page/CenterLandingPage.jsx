// src/pages/landing-page/CenterLandingPage.jsx
// Fetches the center's published landing page and routes to the correct template.
// No published page yet → a "coming soon" page with login buttons (ComingSoonPage);
// center not found → /admin/login.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLoader, GoogleFont } from './utils.jsx';
import ClassicTemplate from './templates/ClassicTemplate';
import ModernTemplate  from './templates/ModernTemplate';
import MinimalTemplate from './templates/MinimalTemplate';
import ComingSoonPage  from './ComingSoonPage';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const TEMPLATES = {
  classic: ClassicTemplate,
  modern:  ModernTemplate,
  minimal: MinimalTemplate,
};

export default function CenterLandingPage() {
  const navigate  = useNavigate();
  const [data,    setData]    = useState(null);
  const [soon,    setSoon]    = useState(null);  // center info while its website isn't published
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = {};
    const h = window.location.hostname;
    const subdomainSlug = h.endsWith('.clemify.com') ? h.replace(/\.clemify\.com$/, '') : null;
    const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;
    const slug = devSlug || subdomainSlug;
    if (slug) headers['x-center-slug'] = slug;
    fetch(`${API}/public/landing-page`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
        else if (d.center) setSoon(d.center);
        else navigate('/admin/login', { replace: true });
      })
      .catch(() => navigate('/admin/login', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <PageLoader />;
  if (soon)    return <ComingSoonPage center={soon} />;
  if (!data)   return null;

  const { center, landingPage: lp } = data;
  const Template = TEMPLATES[lp.template] || ClassicTemplate;

  return (
    <>
      <GoogleFont fontName={lp.design?.fontFamily} />
      <Template center={center} lp={lp} />
    </>
  );
}
