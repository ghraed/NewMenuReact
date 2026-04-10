import React from 'react';
import { resolveAssetUrl } from '../../services/api';
import { cx, focusRing } from '../../theme/liquidGlass';

interface ARButtonProps {
  dish?: {
    assets?: Array<{ asset_type: string; file_url: string }>;
  } | null;
}

const ARButton: React.FC<ARButtonProps> = ({ dish }) => {
  if (!dish?.assets || !Array.isArray(dish.assets)) {
    return null;
  }

  const glbUrl = resolveAssetUrl(dish.assets.find((a) => a.asset_type === 'glb')?.file_url);
  const usdzUrl = resolveAssetUrl(dish.assets.find((a) => a.asset_type === 'usdz')?.file_url);
  const origin = window.location.origin;
  const glbUrlAbs = glbUrl?.startsWith('/') ? `${origin}${glbUrl}` : glbUrl;
  const usdzUrlAbs = usdzUrl?.startsWith('/') ? `${origin}${usdzUrl}` : usdzUrl;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS && usdzUrlAbs) {
    return (
      <a
        href={usdzUrlAbs}
        rel="ar"
        className={cx(
          'group block w-full rounded-full border px-6 py-4 text-center font-semibold transition duration-300 ease-fluid',
          focusRing
        )}
        style={{
          backgroundColor: 'var(--guest-text, rgb(var(--color-gold) / 0.95))',
          borderColor: 'var(--guest-text, rgb(var(--color-gold) / 0.95))',
          color: 'var(--guest-bg, rgb(var(--color-bg0)))',
        }}
      >
        <span>View in AR (iOS)</span>
      </a>
    );
  }

  if (isIOS && glbUrlAbs && !usdzUrlAbs) {
    return (
      <div
        className="rounded-[24px] border p-4 text-sm"
        style={{
          backgroundColor: 'var(--guest-accent-soft, rgb(var(--color-gold) / 0.12))',
          borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
          color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
        }}
      >
        iPhone/iPad AR is not available for this dish yet. The 3D viewer still works, but this item needs a USDZ
        model file for Quick Look.
      </div>
    );
  }

  if (isAndroid && glbUrlAbs) {
    const viewerUrl = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrlAbs)}&mode=ar_preferred`;

    return (
      <div className="space-y-2">
        <p className="text-center text-xs text-[var(--guest-muted, rgb(var(--color-text) / 0.55))]">Requires Chrome and ARCore</p>
        <a
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            'group block w-full rounded-full border px-6 py-4 text-center font-semibold transition duration-300 ease-fluid',
            focusRing
          )}
          style={{
            backgroundColor: 'var(--guest-text, rgb(var(--color-gold) / 0.95))',
            borderColor: 'var(--guest-text, rgb(var(--color-gold) / 0.95))',
            color: 'var(--guest-bg, rgb(var(--color-bg0)))',
          }}
        >
          <span>View in AR (Scene Viewer)</span>
        </a>
      </div>
    );
  }

  return null;
};

export default ARButton;
