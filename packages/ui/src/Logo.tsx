import React from 'react';

interface LogoProps {
  iconSize?: number;
  iconOnly?: boolean;
  className?: string;
}

export function Logo({ iconSize = 28, iconOnly = false, className = '' }: LogoProps) {
  const height = iconSize;

  if (iconOnly) {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img
          src="/carp-partners-logo.png"
          alt="Carp Partners TV"
          style={{ height, width: 'auto', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/carp-partners-logo.png"
        alt="Carp Partners TV"
        style={{ height, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  );
}
