// src/context/BrandingContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCachedBranding,
  getCachedCenter,
  subscribeBranding,
  DEFAULT_BRANDING,
} from '../utils/branding.js';

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  center:   null,
});

export const BrandingProvider = ({ children }) => {
  // Read from cache set during startup (avoids second fetch). On a returning
  // visit that cache starts as the saved branding and is replaced once the
  // background refresh in main.jsx lands — subscribe so that update shows.
  const [branding, setBranding] = useState(getCachedBranding);
  const [center,   setCenter]   = useState(getCachedCenter);

  useEffect(() => {
    const sync = () => {
      setBranding(getCachedBranding());
      setCenter(getCachedCenter());
    };
    sync(); // catch an update that landed between first render and subscribing
    return subscribeBranding(sync);
  }, []);

  const value = useMemo(() => ({ branding, center }), [branding, center]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

// Hook for any component that needs branding data
export const useBranding = () => useContext(BrandingContext);
