// src/context/BrandingContext.jsx
import { createContext, useContext, useState } from 'react';
import {
  getCachedBranding,
  getCachedCenter,
  DEFAULT_BRANDING,
} from '../utils/branding.js';

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  center:   null,
});

export const BrandingProvider = ({ children }) => {
  // Read from cache set during startup (avoids second fetch)
  const [branding] = useState(getCachedBranding);
  const [center]   = useState(getCachedCenter);

  return (
    <BrandingContext.Provider value={{ branding, center }}>
      {children}
    </BrandingContext.Provider>
  );
};

// Hook for any component that needs branding data
export const useBranding = () => useContext(BrandingContext);
