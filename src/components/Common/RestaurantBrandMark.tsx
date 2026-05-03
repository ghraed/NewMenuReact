import React, { useMemo, useState } from 'react';
import { resolveAssetUrl } from '../../services/api';

interface RestaurantBrandMarkProps {
  name?: string | null;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

const getRestaurantInitial = (name?: string | null): string => {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'R';
};

const RestaurantBrandMark: React.FC<RestaurantBrandMarkProps> = ({
  name,
  logoUrl,
  className = 'h-12 w-12',
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedLogoUrl = useMemo(() => resolveAssetUrl(logoUrl), [logoUrl]);

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-gold/30 bg-gold/10 ${className}`}
      aria-hidden="true"
    >
      {resolvedLogoUrl && !imageFailed ? (
        <img
          src={resolvedLogoUrl}
          alt=""
          className={imageClassName}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center text-sm font-semibold text-gold2 ${fallbackClassName}`}>
          {getRestaurantInitial(name)}
        </div>
      )}
    </div>
  );
};

export default RestaurantBrandMark;
