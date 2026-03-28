import React, { useEffect, useRef, useState } from 'react';
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
}

const DishViewer: React.FC<DishViewerProps> = ({ dish, viewerClassName = 'h-96' }) => {
  if (!dish || !dish.assets) {
    return (
      <div
        className="rounded-[28px] border p-4"
        style={{
          backgroundColor: 'var(--guest-panel, rgb(var(--color-bg1)))',
          borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
          color: 'var(--guest-text, rgb(var(--color-text) / 0.92))',
        }}
      >
        Error: Dish data not available
      </div>
    );
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const capabilities = useDeviceCapability();
  const { trackEvent } = useAnalytics();

  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);

  useEffect(() => {
    const mountNode = containerRef.current;
    if (!mountNode) return;

    isCleaningUpRef.current = false;
    setIsLoading(true);
    setError(null);

    const existingCanvas = mountNode.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, mountNode.clientWidth / mountNode.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 2.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountNode.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    controls.autoRotate = false;
    controls.maxPolarAngle = Math.PI / 1.5;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.05);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffd89e, 0.45);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    const glbUrl = resolveAssetUrl(dish.assets.find((a) => a.asset_type === 'glb')?.file_url);

    if (!glbUrl) {
      setError('No 3D model available');
      setIsLoading(false);
      return;
    }

    const loader = new GLTFLoader();

    loader.load(
      glbUrl,
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

        model.traverse((child: any) => {
          const mesh = child as any;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        scene.add(model);

        camera.position.set(0, 1.8, 2.2);
        controls.target.set(0, 0.2, 0);
        controls.autoRotate = false;
        controls.update();

        setIsLoading(false);
        trackEvent('3d_model_loaded');
      },
      undefined,
      () => {
        if (isCleaningUpRef.current) return;
        setError('Failed to load 3D model');
        setIsLoading(false);
      }
    );

    const animate = () => {
      if (isCleaningUpRef.current) return;
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (rendererRef.current) {
        const canvas = rendererRef.current.domElement;
        if (mountNode?.contains(canvas)) {
          mountNode.removeChild(canvas);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      scene.traverse((object: any) => {
        const mesh = object as any;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const mat = mesh.material;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    };
  }, [dish.id, dish.assets, trackEvent]);

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className={`relative w-full cursor-grab overflow-hidden rounded-[28px] border active:cursor-grabbing ${viewerClassName}`}
        aria-label="3D dish viewer - click and drag to rotate"
        style={{
          backgroundColor: 'var(--guest-panel-strong, rgb(var(--color-bg1)))',
          borderColor: 'var(--guest-border, rgba(255,255,255,0.12))',
        }}
      >
        {isLoading && (
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

        {error && (
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

      {(capabilities.isARSupported || isIOS || isAndroid) && <ARButton dish={dish} />}

      {!capabilities.isARSupported && !isIOS && !isAndroid && (
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
