import React from "react";

export function NovaLogo({ className = "brand-logo" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nova-logo-specular" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="nova-logo-titanium" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id="nova-logo-shadow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
        <radialGradient id="nova-logo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g id="nova-emblem-graphic">
        {/* North Blade */}
        <polygon points="32,4 27,27 32,29.5" fill="url(#nova-logo-specular)" />
        <polygon points="32,4 32,29.5 37,27" fill="url(#nova-logo-titanium)" />

        {/* East Blade */}
        <polygon points="60,32 34.5,32 37,27" fill="url(#nova-logo-specular)" />
        <polygon points="60,32 37,37 34.5,32" fill="url(#nova-logo-shadow)" />

        {/* South Blade */}
        <polygon points="32,60 37,37 32,34.5" fill="url(#nova-logo-titanium)" />
        <polygon points="32,60 32,34.5 27,37" fill="url(#nova-logo-shadow)" />

        {/* West Blade */}
        <polygon points="4,32 29.5,32 27,37" fill="url(#nova-logo-titanium)" />
        <polygon points="4,32 27,27 29.5,32" fill="url(#nova-logo-specular)" />

        {/* 4 Diagonal Precision Chamfer Flares */}
        <polygon points="32,27 41,23 37,32 34,29" fill="url(#nova-logo-specular)" opacity="0.95" />
        <polygon points="37,32 41,41 32,37 34,35" fill="url(#nova-logo-shadow)" opacity="0.9" />
        <polygon points="32,37 23,41 27,32 30,35" fill="url(#nova-logo-shadow)" opacity="0.9" />
        <polygon points="27,32 23,23 32,27 30,29" fill="url(#nova-logo-specular)" opacity="0.95" />

        {/* Floating Core Node */}
        <circle cx="32" cy="32" r="3.5" fill="url(#nova-logo-glow)" />
        <polygon points="32,28.8 35.2,32 32,35.2 28.8,32" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
export default NovaLogo;
