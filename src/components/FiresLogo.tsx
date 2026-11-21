import React from 'react';

interface FiresLogoProps {
  size?: number;
  className?: string;
}

export const FiresLogo: React.FC<FiresLogoProps> = ({ size = 28, className = '' }) => {
  const gradId = React.useId();
  const emberId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="7" y1="26" x2="22" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="48%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
        <linearGradient id={emberId} x1="16" y1="10" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Deep pure black badge */}
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="#050507" stroke="#222228" strokeWidth="1" />

      {/* Subtle second-shade-of-black letter "A" positioned in the back right corner */}
      <path
        d="M22.2 13.8H24.6L28.8 27.2H26.2L25.3 24.1H21.4L20.5 27.2H18L22.2 13.8ZM22 21.8H24.7L23.4 17.1L22 21.8Z"
        fill="#16161b"
        stroke="#22222a"
        strokeWidth="0.45"
        strokeLinejoin="round"
      />

      {/* Soft ambient flame glow behind the F */}
      <path
        d="M17.2 5.4C17.8 7.5 16.9 9 15.9 10.2C18.1 9.8 20.1 11 20.7 13.5C21.4 16.8 19.3 21.1 15.8 23.4C13.4 25 10.1 24.8 8.4 22.9C7.1 21.3 7.2 18.6 8.4 16.9C9.1 18 10 18.4 10.8 18.3C9.4 15.8 10 12 12.6 9.6C14.1 8.1 15.6 7 17.2 5.4Z"
        fill={`url(#${emberId})`}
      />

      {/* Crisp fiery letter F in foreground */}
      <path
        d="M8.8 24.4V9.7C8.8 8.3 9.7 7.2 11.1 7L19.6 5.8C18.9 7.6 17.6 8.8 15.7 9.3L12.1 10V14.2H17.6C17.1 15.9 15.8 17 14 17.2H12.1V22.1C12.1 23.3 10.9 24.2 8.8 24.4Z"
        fill={`url(#${gradId})`}
      />

      {/* Subtle spark tip */}
      <path
        d="M18.9 10.2C19.9 11.2 20.3 12.6 19.7 13.9C19.1 13 18.5 12.5 17.7 12.2C18.3 11.4 18.6 10.8 18.9 10.2Z"
        fill="#fef08a"
      />
    </svg>
  );
};
