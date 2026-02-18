import React from 'react';
import { resolveAssetUrl } from '../../services/api';
import { cx, glassControl, getModernMode } from '../../theme/liquidGlass';

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

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS && usdzUrl) {
    return (
      <a
        href={usdzUrl}
        rel="ar"
        className={cx(
          'group relative block w-full overflow-hidden rounded-full border px-6 py-4 text-center font-semibold text-white transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
          glassControl(modern),
          'lg-lift-sm !bg-lg-secondary/52 !border-lg-secondary/45'
        )}
      >
        <span className="relative z-10">View in AR (iOS)</span>
      </a>
    );
  }

  if (isAndroid && glbUrl) {
    const viewerUrl = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred`;

    return (
      <div className="space-y-2">
        <a
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            'group relative block w-full overflow-hidden rounded-full border px-6 py-4 text-center font-semibold text-white transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
            glassControl(modern),
            'lg-lift-sm !bg-lg-primary/55 !border-lg-primary/45'
          )}
        >
          <span className="relative z-10">View in AR (Scene Viewer)</span>
        </a>
        <p className="text-center text-xs text-slate-700/70">Requires Chrome and ARCore</p>
      </div>
    );
  }

  return null;
};

export default ARButton;
