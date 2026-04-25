import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useDeviceCapability } from '../../hooks/useDeviceCapability';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { Dish } from '../../types';
import ARButton from '../AR/ARButton';
import LoadingSpinner from '../Common/LoadingSpinner';
import { resolveAssetUrl } from '../../services/api';

interface DishViewerProps {
  dish: Dish;
  viewerClassName?: string;
  presentationMode?: 'default' | 'guest-detail';
}

const DishViewer: React.FC<DishViewerProps> = ({
  dish,
  viewerClassName = 'h-96',
  presentationMode = 'default',
}) => {
  const { t } = useTranslation();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const capabilities = useDeviceCapability();
  const { trackEvent } = useAnalytics();
  const isGuestDetail = presentationMode === 'guest-detail';

  // The project uses broad local shims for three.js example modules, so these refs stay loosely typed here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);
  const hasDishAssets = Array.isArray(dish?.assets);
  const previewAssetUrl = resolveAssetUrl(
    hasDishAssets ? dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url : null
  );
  const dishPhotoUrl = resolveAssetUrl(dish?.image_url ?? null);
  const glbUrl = resolveAssetUrl(hasDishAssets ? dish.assets.find((asset) => asset.asset_type === 'glb')?.file_url : null);
  const guestPreviewUrl = dishPhotoUrl || previewAssetUrl;
  const defaultPreviewUrl = previewAssetUrl || dishPhotoUrl;
  const loadingPreviewUrl = isGuestDetail ? guestPreviewUrl : defaultPreviewUrl;
  const fallbackPreviewUrl = guestPreviewUrl || defaultPreviewUrl;
  const shouldShowStaticFallback = isGuestDetail && (!glbUrl || modelLoadFailed);
  const shouldShowLoadingPreview = isGuestDetail && Boolean(glbUrl) && !modelLoadFailed && !isModelReady;
  const isInteractive = Boolean(glbUrl) && !modelLoadFailed && isModelReady;
  const shouldShowArButton = Boolean(glbUrl) && !modelLoadFailed && (capabilities.isARSupported || isIOS || isAndroid);
  const shouldShowArUnsupportedNotice = Boolean(glbUrl) && !modelLoadFailed && !capabilities.isARSupported && !isIOS && !isAndroid;

  useEffect(() => {
    if (!hasDishAssets) {
      return;
    }

    const mountNode = containerRef.current;
    if (!mountNode) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    isCleaningUpRef.current = false;
    setIsLoading(true);
    setIsModelReady(false);
    setError(null);
    setModelLoadFailed(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    const existingCanvas = mountNode.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();

    if (!glbUrl) {
      controlsRef.current = null;
      rendererRef.current = null;
      if (isGuestDetail) {
        setModelLoadFailed(true);
        setError(null);
      } else {
        setError(t('dishViewer.noModel'));
      }
      setIsLoading(false);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, mountNode.clientWidth / mountNode.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 2.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 450ms cubic-bezier(0.16, 1, 0.3, 1)';
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.05);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffd89e, 0.45);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    let hasCleanedUp = false;

    const cleanupViewer = () => {
      if (hasCleanedUp) {
        return;
      }

      hasCleanedUp = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (rendererRef.current) {
        const canvas = rendererRef.current.domElement;
        if (mountNode.contains(canvas)) {
          mountNode.removeChild(canvas);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      scene.traverse((object: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mesh = object as any;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const material = mesh.material;
        if (material) {
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });
    };

    const loader = new GLTFLoader();

    const enableInteractiveViewer = () => {
      if (!mountNode.contains(renderer.domElement)) {
        mountNode.appendChild(renderer.domElement);
      }

      renderer.domElement.style.touchAction = 'none';

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 1.5;
      controls.maxDistance = 5;
      controls.autoRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI - 0.08;
      controls.target.set(0, 0, 0);
      controls.update();
      controlsRef.current = controls;

      const animate = () => {
        if (isCleaningUpRef.current) return;
        animationIdRef.current = requestAnimationFrame(animate);
        controlsRef.current?.update();
        renderer.render(scene, camera);
      };

      renderer.render(scene, camera);

      requestAnimationFrame(() => {
        if (isCleaningUpRef.current) return;
        renderer.domElement.style.opacity = '1';
        setIsModelReady(true);
        setIsLoading(false);
        animate();
        trackEvent('3d_model_loaded');
      });
    };

    loader.load(
      glbUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gltf: any) => {
        if (isCleaningUpRef.current) return;

        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        model.traverse((child: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = child as any;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        scene.add(model);

        camera.position.set(0, 1.8, 2.2);
        enableInteractiveViewer();
      },
      undefined,
      () => {
        if (isCleaningUpRef.current) return;

        cleanupViewer();

        if (isGuestDetail) {
          setModelLoadFailed(true);
          setError(null);
        } else {
          setError(t('dishViewer.failedToLoadModel'));
        }
        setIsLoading(false);
      }
    );

    const handleResize = () => {
      if (!mountNode || !rendererRef.current) return;
      const width = mountNode.clientWidth;
      const height = mountNode.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCleaningUpRef.current = true;
      cleanupViewer();
    };
  }, [dish.id, dish.assets, glbUrl, hasDishAssets, isGuestDetail, t, trackEvent]);

  if (!hasDishAssets) {
    return (
      <div
        className="rounded-[28px] border p-4"
        style={{
          backgroundColor: 'var(--guest-panel, rgb(var(--color-bg1)))',
          borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
          color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
        }}
      >
        {t('dishViewer.noDishData')}
      </div>
    );
  }

  const posterContent = (loadingPreviewUrl || fallbackPreviewUrl) ? (
    <>
      <img
        src={loadingPreviewUrl || fallbackPreviewUrl}
        alt={dish.name}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--guest-panel, rgb(var(--color-bg1))) 18%, transparent)' }}
      />
    </>
  ) : (
    <div
      className="flex h-full w-full items-center justify-center text-5xl"
      style={{
        backgroundColor: 'var(--guest-accent-soft, rgb(var(--color-gold) / 0.2))',
        color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
      }}
    >
      🍽
    </div>
  );

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden rounded-[28px] border ${isInteractive ? 'cursor-grab active:cursor-grabbing' : ''} ${viewerClassName}`}
        aria-label={isInteractive ? t('dishViewer.interactiveLabel') : t('dishViewer.previewLabel')}
        style={{
          backgroundColor: 'var(--guest-panel-strong, rgb(var(--color-bg1)))',
          borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
        }}
      >
        {!isGuestDetail && !isModelReady && defaultPreviewUrl && (
          <div className="pointer-events-none absolute inset-0">
            {posterContent}
          </div>
        )}

        {shouldShowLoadingPreview && (
          <div className="absolute inset-0">
            {posterContent}
          </div>
        )}

        {shouldShowStaticFallback && (
          <>
            <div className="absolute inset-0">
              {posterContent}
            </div>
            <div
              className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-[22px] border px-4 py-3 backdrop-blur-md"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--guest-panel, rgb(var(--color-bg1))) 88%, transparent)',
                borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
                boxShadow: 'var(--guest-shadow-soft)',
              }}
            >
              <p className="text-sm font-medium text-[var(--guest-text, rgb(var(--color-text) / 0.92))]">
                3D preview unavailable for this dish.
              </p>
            </div>
          </>
        )}

        {!shouldShowStaticFallback && !shouldShowLoadingPreview && !isModelReady && isLoading && !defaultPreviewUrl && !guestPreviewUrl && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--guest-panel, rgb(var(--color-bg1))) 72%, transparent)' }}
          >
            <div className="text-center">
              <LoadingSpinner variant="primary" />
              <p className="mt-2 text-sm text-[var(--guest-muted, rgb(var(--color-text) / 0.7))]">Loading 3D model...</p>
            </div>
          </div>
        )}

        {!isGuestDetail && error && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4"
            style={{ backgroundColor: 'color-mix(in srgb, var(--guest-panel, rgb(var(--color-bg1))) 86%, transparent)' }}
          >
            <div className="mb-2 text-lg font-medium text-[var(--guest-text, rgb(var(--color-text) / 0.92))]">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border px-4 py-2 text-sm transition"
              style={{
                backgroundColor: 'var(--guest-accent-soft, rgb(var(--color-gold) / 0.14))',
                borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
                color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {shouldShowArButton && <ARButton dish={dish} />}

      {shouldShowArUnsupportedNotice && (
        <div
          className="rounded-[24px] border p-4 text-sm"
          style={{
            backgroundColor: 'var(--guest-accent-soft, rgb(var(--color-gold) / 0.12))',
            borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
            color: 'var(--guest-accent, rgb(var(--color-gold2) / 0.92))',
          }}
        >
          <strong>AR Not Available:</strong> Use an iOS device (iOS 12+) or Android with Chrome/WebXR support.
        </div>
      )}
    </div>
  );
};

export default DishViewer;
