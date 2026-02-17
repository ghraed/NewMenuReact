// components/AR/ARButton.tsx
import React, { useState, useEffect } from 'react';
import { resolveAssetUrl } from '../../services/api';

interface ARButtonProps {
    dish?: {
        assets?: Array<{ asset_type: string; file_url: string }>;
    } | null;
}

const ARButton: React.FC<ARButtonProps> = ({ dish }) => {
    const [webXRSupported, setWebXRSupported] = useState(false);

    useEffect(() => {
        if ('xr' in navigator) {
            // @ts-ignore
            navigator.xr?.isSessionSupported('immersive-ar').then(setWebXRSupported);
        }
    }, []);

    if (!dish?.assets || !Array.isArray(dish.assets)) {
        return null;
    }

    const glbUrl = resolveAssetUrl(
        dish.assets.find(a => a.asset_type === 'glb')?.file_url
    );

    const usdzUrl = resolveAssetUrl(
        dish.assets.find(a => a.asset_type === 'usdz')?.file_url
    );

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    // iOS: AR Quick Look
    if (isIOS && usdzUrl) {
        return (
            <a
                href={usdzUrl}
                rel="ar"
                className="block w-full bg-green-500 text-white font-bold py-4 px-6 rounded-xl text-center"
            >
                View in AR (iOS)
            </a>
        );
    }

    // Android: Use Google's official viewer link format
    if (isAndroid && glbUrl) {
        // This format opens Chrome's built-in AR viewer without crashing
        // It uses the "model-viewer" app link which is more stable
        const viewerUrl = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred`;
        console.log('AR Scene Viewer URL:', viewerUrl);



        // Alternative: Use the "open in AR" link format
        const arLink = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;

        return (
            <div className="space-y-2">
                <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-blue-500 text-white font-bold py-4 px-6 rounded-xl text-center"
                >
                    View in AR (Scene Viewer)
                </a>
                <p className="text-xs text-gray-500 text-center">
                    Requires Chrome and ARCore
                </p>
            </div>
        );
    }

    return null;
};

export default ARButton;
