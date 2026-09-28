import React from 'react';

export interface RaptorLogoProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const RaptorLogo: React.FC<RaptorLogoProps> = ({
  size = 28,
  className = '',
  glow = false,
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-md -z-10 animate-pulse" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-contain"
      >
        <defs>
          <linearGradient id="raptorLogoGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="60%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="raptorLogoAccent" x1="12" y1="8" x2="36" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Outer Minimalist Shield Geometry */}
        <path
          d="M6 8L20 2L34 8V22C34 30.5 28 36.5 20 39C12 36.5 6 30.5 6 22V8Z"
          className="fill-slate-900/40 dark:fill-slate-950/60 stroke-amber-500/30 dark:stroke-amber-500/20"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Precision Geometric 'R' Monogram */}
        {/* Left Pillar */}
        <path
          d="M13 11H17.5V29H13V11Z"
          fill="url(#raptorLogoGrad)"
        />

        {/* Top Arc & Loop */}
        <path
          d="M17.5 11H25C27.76 11 30 13.24 30 16C30 18.76 27.76 21 25 21H17.5V11ZM21.5 14.5V17.5H24.5C25.33 17.5 26 16.83 26 16C26 15.17 25.33 14.5 24.5 14.5H21.5Z"
          fill="url(#raptorLogoGrad)"
        />

        {/* Sharp Aerodynamic Kick Leg (Diagonal Talon) */}
        <path
          d="M21 19.5L28.5 29H23.5L17.5 21.5H21Z"
          fill="url(#raptorLogoGrad)"
        />

        {/* Dynamic Forward Slash / Speed Accent */}
        <path
          d="M12 24L31 8.5L25 14L12 24Z"
          fill="url(#raptorLogoAccent)"
        />
      </svg>
    </div>
  );
};
