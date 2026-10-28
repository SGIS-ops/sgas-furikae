import React from 'react';
import shieldLogoUrl from '../assets/images/shield_logo_1786617472721.jpg';
import { Shield } from 'lucide-react';

interface ShieldLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showImage?: boolean;
}

export const ShieldLogo: React.FC<ShieldLogoProps> = ({ className = '', size = 'sm', showImage = true }) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  }[size];

  if (showImage) {
    return (
      <img
        src={shieldLogoUrl}
        alt="SOLTILO GSA"
        referrerPolicy="no-referrer"
        className={`inline-block object-contain rounded-xs ${sizeClasses} ${className}`}
      />
    );
  }

  return <Shield className={`${sizeClasses} text-[#1F3C6B] fill-blue-900/10 ${className}`} />;
};
