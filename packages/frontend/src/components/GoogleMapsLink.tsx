import React from 'react';
import { MapPin } from 'lucide-react';

interface GoogleMapsLinkProps {
  url: string | null | undefined;
  label?: string;
}

export const GoogleMapsLink: React.FC<GoogleMapsLinkProps> = ({ url, label = 'View on Map' }) => {
  if (!url) {
    return <span className="text-gray-500 text-xs">No location</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-nesma-secondary hover:text-nesma-accent transition-colors"
    >
      <MapPin className="w-3.5 h-3.5" />
      {label}
    </a>
  );
};
