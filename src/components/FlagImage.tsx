import React from 'react';

interface FlagImageProps {
  code: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export default function FlagImage({ code, className, alt, width, height }: FlagImageProps) {
  if (!code) {
    return (
      <div 
        className={`inline-block bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-sm border border-black/10 ${className || ''}`} 
        style={{ width: width || 24, height: height || 16 }}
      />
    );
  }

  const isUrl = code.startsWith('http://') || code.startsWith('https://') || code.startsWith('data:');
  const src = isUrl ? code : `https://flagcdn.com/${code.toLowerCase()}.svg`;

  return (
    <img 
      src={src} 
      className={className} 
      alt={alt || `${code} flag`} 
      width={width} 
      height={height} 
      referrerPolicy="no-referrer" 
      onError={(e) => {
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
}