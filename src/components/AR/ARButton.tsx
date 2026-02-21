import React from 'react';
import { resolveAssetUrl } from '../../services/api';
import { cx, glassControl, getModernMode, primaryGradient, secondaryGradient } from '../../theme/liquidGlass';

interface ARButtonProps {
  dish?: {
    assets?: Array<{ asset_type: string; file_url: string }>;
  } | null;
}

const ARButton: React.FC<ARButtonProps> = ({ dish }) => {
  if (!dish?.assets || !Array.isArray(dish.assets)) {
    return null;
  }

  const modern = getModernMode();
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
          'group relative block w-full overflow-hidden rounded-full border px-6 py-4 text-center font-semibold text-lg-text transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
          glassControl(modern),
          'lg-lift-sm'
        )}
      >
        <span className={cx('pointer-events-none absolute inset-0 bg-gradient-to-r opacity-90', secondaryGradient)} />
        <span className="relative z-10">View in AR (iOS)</span>
      </a>
    );
  }

  if (isAndroid && glbUrlAbs) {
    const viewerUrl = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrlAbs)}&mode=ar_preferred`;

    return (
      <div className="space-y-2">
        <a
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            'group relative block w-full overflow-hidden rounded-full border px-6 py-4 text-center font-semibold text-lg-text transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
            glassControl(modern),
            'lg-lift-sm'
          )}
        >
          <span className={cx('pointer-events-none absolute inset-0 bg-gradient-to-r opacity-90', primaryGradient)} />
          <span className="relative z-10">View in AR (Scene Viewer)</span>
        </a>
        <p className="text-center text-xs text-slate-700/70">Requires Chrome and ARCore</p>
      </div>
    );
  }

  return null;
};

export default ARButton;
