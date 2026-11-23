import React from "react";

type KanaLogoProps = { size?: number };

/** SatyaAI's custom particle mark for Kaṇa (कण). */
export function KanaLogo({ size = 20 }: KanaLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r="12.1" stroke="currentColor" strokeWidth="1.65" strokeDasharray="2.8 2.2" opacity="0.72" />
      <ellipse cx="18" cy="18" rx="14.2" ry="5.6" transform="rotate(-36 18 18)" stroke="currentColor" strokeWidth="1.55" opacity="0.88" />
      <circle cx="18" cy="18" r="3.5" fill="currentColor" />
      <circle cx="29.1" cy="9.1" r="2.1" fill="currentColor" />
      <circle cx="6.5" cy="22.9" r="1.6" fill="currentColor" opacity="0.78" />
    </svg>
  );
}
