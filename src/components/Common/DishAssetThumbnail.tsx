import React, { useState } from 'react';
import '@google/model-viewer';
import type { Dish } from '../../types';
import { resolveAssetUrl } from '../../services/api';

interface DishAssetThumbnailProps {
  dish: Dish;
  className?: string;
}

const DishAssetThumbnail: React.FC<DishAssetThumbnailProps> = ({ dish, className = 'h-20 w-20' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const imageUrl = resolveAssetUrl(dish.image_url);
  const glbUrl = resolveAssetUrl(dish.assets.find((asset) => asset.asset_type === 'glb')?.file_url);
  const ModelViewer = 'model-viewer' as React.ElementType;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/15 bg-bg1 ${className}`}>
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={dish.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain object-center p-1.5"
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
        <div className="flex h-full w-full items-center justify-center bg-gold/20 text-2xl text-text">
          🍽
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-white/10" />
    </div>
  );
};

export default DishAssetThumbnail;
