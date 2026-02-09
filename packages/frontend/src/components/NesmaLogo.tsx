import React from 'react';

export const NesmaLogo: React.FC<{ className?: string, variant?: 'white' | 'color', showText?: boolean }> = ({
  className = "h-10",
  variant = 'white',
  showText = true
}) => {
  const primaryColor = variant === 'white' ? '#FFFFFF' : '#2E3192';
  const secondaryColor = '#80D1E9'; // Cyan accent

  return (
    <svg viewBox="0 0 240 30.65" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* T - Right vertical bar */}
      <rect fill={primaryColor} x="46.4" y=".04" width="10.53" height="30.52"/>

      {/* N - Left vertical bar */}
      <rect fill={primaryColor} x="0" y=".02" width="10.52" height="30.56"/>

      {/* N - Diagonal shape */}
      <path fill={primaryColor} d="M30.89,16.55v13.93s0,.02,0,0L13.01,13.47s0,0,0,0V.06s0-.02,0,0l17.88,16.49s0,0,0,0"/>

      {/* I - Vertical bar */}
      <rect fill={primaryColor} x="33.38" y="10.69" width="10.53" height="19.87"/>

      {/* I - Cyan triangle accent */}
      <polygon fill={secondaryColor} points="33.38 8.75 33.38 .02 43.91 .02 33.38 8.75"/>

      {/* T - Horizontal extension */}
      <rect fill={primaryColor} x="58.95" y="11.2" width="9.4" height="7.32"/>

      {showText && (
        <>
          {/* Separator Line */}
          <rect fill={primaryColor} x="80" y="0" width="0.5" height="30.65" opacity="0.5"/>

          {/* Text - NESMA */}
          <text x="90" y="12" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fontSize="10" fill={primaryColor} letterSpacing="1.5">
            NESMA
          </text>

          {/* Text - INFRASTRUCTURE */}
          <text x="90" y="21" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fontSize="6" fill={primaryColor} letterSpacing="0.8">
            INFRASTRUCTURE
          </text>

          {/* Text - & TECHNOLOGY */}
          <text x="90" y="29" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fontSize="6" fill={primaryColor} letterSpacing="0.8">
            & TECHNOLOGY
          </text>
        </>
      )}
    </svg>
  );
};

// Icon only version (no text) - same proportions
export const NesmaIcon: React.FC<{ className?: string, variant?: 'white' | 'color' }> = ({
  className = "h-8",
  variant = 'white'
}) => {
  const primaryColor = variant === 'white' ? '#FFFFFF' : '#2E3192';
  const secondaryColor = '#80D1E9';

  return (
    <svg viewBox="0 0 68.35 30.65" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* T - Right vertical bar */}
      <rect fill={primaryColor} x="46.4" y=".04" width="10.53" height="30.52"/>

      {/* N - Left vertical bar */}
      <rect fill={primaryColor} x="0" y=".02" width="10.52" height="30.56"/>

      {/* N - Diagonal shape */}
      <path fill={primaryColor} d="M30.89,16.55v13.93s0,.02,0,0L13.01,13.47s0,0,0,0V.06s0-.02,0,0l17.88,16.49s0,0,0,0"/>

      {/* I - Vertical bar */}
      <rect fill={primaryColor} x="33.38" y="10.69" width="10.53" height="19.87"/>

      {/* I - Cyan triangle */}
      <polygon fill={secondaryColor} points="33.38 8.75 33.38 .02 43.91 .02 33.38 8.75"/>

      {/* T - Horizontal extension */}
      <rect fill={primaryColor} x="58.95" y="11.2" width="9.4" height="7.32"/>
    </svg>
  );
};
