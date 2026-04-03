import React, { useState } from 'react';
import '@google/model-viewer';
import type { Dish } from '../../types';
import { resolveAssetUrl } from '../../services/api';

interface DishAssetThumbnailProps {
  dish: Dish;
  className?: string;
  fit?: 'contain' | 'cover';
  imageClassName?: string;
  overlayClassName?: string;
}

const DishAssetThumbnail: React.FC<DishAssetThumbnailProps> = ({
  dish,
  className = 'h-20 w-20',
  fit = 'contain',
  imageClassName = '',
  overlayClassName = 'bg-white/10',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const imageUrl = resolveAssetUrl(
    dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url || dish.image_url,
  );
  const glbUrl = resolveAssetUrl(dish.assets.find((asset) => asset.asset_type === 'glb')?.file_url);
  const ModelViewer = 'model-viewer' as React.ElementType;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        backgroundColor: 'var(--guest-panel-strong, rgb(var(--color-bg1)))',
        border: '1px solid var(--guest-border, rgba(255,255,255,0.15))',
      }}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={dish.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className={`h-full w-full object-center ${fit === 'cover' ? 'object-cover' : 'object-contain p-1.5'} ${imageClassName}`}
        />
      ) : glbUrl && !modelFailed ? (
        <div className="pointer-events-none h-full w-full p-1.5">
          <ModelViewer
            src={glbUrl}
            camera-target="auto auto auto"
            camera-orbit="0deg 75deg auto"
            min-camera-orbit="auto auto auto"
            max-camera-orbit="auto auto auto"
            field-of-view="26deg"
            bounds="tight"
            environment-image="neutral"
            shadow-intensity="0"
            interaction-prompt="none"
            disable-zoom
            disable-pan
            onError={() => setModelFailed(true)}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-2xl"
          style={{
            backgroundColor: 'var(--guest-accent-soft, rgb(var(--color-gold) / 0.2))',
            color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
          }}
        >
          🍽
        </div>
      )}

      <div className={`pointer-events-none absolute inset-0 ${overlayClassName}`} />
    </div>
  );
};

export default DishAssetThumbnail;
