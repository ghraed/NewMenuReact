// src/hooks/useDeviceCapability.ts
import { useState, useEffect } from 'react';

interface DeviceCapabilities {
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  hasWebXR: boolean;
  isARSupported: boolean;
  hasCameraAccess: boolean;
}

export const useDeviceCapability = (): DeviceCapabilities => {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    platform: 'unknown',
    hasWebXR: false,
    isARSupported: false,
    hasCameraAccess: false,
  });

  useEffect(() => {
    const detectPlatform = (): 'ios' | 'android' | 'desktop' | 'unknown' => {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/android/.test(ua)) return 'android';
      if (/macintosh|windows|linux/.test(ua)) return 'desktop';
      return 'unknown';
    };

    const detectWebXR = async (): Promise<boolean> => {
      try {
        return !!(navigator as any).xr;
      } catch {
        return false;
      }
    };

    const checkCameraAccess = async (): Promise<boolean> => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
      } catch {
        return false;
      }
    };

    const init = async () => {
      const platform = detectPlatform();
      const hasWebXR = await detectWebXR();
      const hasCameraAccess = await checkCameraAccess();
      const isARSupported = (platform === 'ios' || hasWebXR) && hasCameraAccess;

      setCapabilities({
        platform,
        hasWebXR,
        isARSupported,
        hasCameraAccess,
      });
    };

    init();
  }, []);

  return capabilities;
};