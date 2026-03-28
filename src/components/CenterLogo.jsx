// src/components/CenterLogo.jsx
import { useBranding } from '../context/BrandingContext';

export default function CenterLogo({ size = 'md', showName = false }) {
  const { branding, center } = useBranding();

  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
  };

  return (
    <div className="flex items-center gap-2">
      {branding.logo ? (
        <img
          src={branding.logo}
          alt={center?.centerName || 'Logo'}
          className={`${sizes[size]} w-auto object-contain`}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div
          className={`${sizes[size]} aspect-square rounded-lg flex items-center justify-center text-white font-bold text-sm`}
          style={{ backgroundColor: branding.primaryColor }}
        >
          {(center?.centerName || 'EL').charAt(0).toUpperCase()}
        </div>
      )}
      {showName && center?.centerName && (
        <span className="font-semibold text-gray-900 dark:text-white">
          {center.centerName}
        </span>
      )}
    </div>
  );
}
