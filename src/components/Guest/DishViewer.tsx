import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Import this
import { useDeviceCapability } from '../../hooks/useDeviceCapability';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { Dish } from '../../types';
import ARButton from '../AR/ARButton';
import LoadingSpinner from '../Common/LoadingSpinner';
import { USDZExporter } from 'three/examples/jsm/Addons.js';

interface DishViewerProps {
    dish: Dish;
}

const DishViewer: React.FC<DishViewerProps> = ({ dish }) => {
    if (!dish || !dish.assets) {
        return (
            <div className="p-4 text-red-600 bg-red-50 rounded-lg">
                Error: Dish data not available
            </div>
        );
    }
    // Hardcoded USDZ URL for testing
    // const hardcodedUsdzUrl = '/storage/dishes/10/model.glb';
    const hardcodedUsdzUrl = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';


    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const capabilities = useDeviceCapability();
    const { trackEvent } = useAnalytics();

    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null); // Ref for controls
    const animationIdRef = useRef<number>(0);
    const isCleaningUpRef = useRef(false);

    useEffect(() => {
        const mountNode = containerRef.current;
        if (!mountNode) return;

        isCleaningUpRef.current = false;
        setIsLoading(true);
        setError(null);

        // Clean up previous canvases (React StrictMode handling)
        const existingCanvas = mountNode.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();

        // ===== SCENE SETUP =====
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);

        const camera = new THREE.PerspectiveCamera(
            45,
            mountNode.clientWidth / mountNode.clientHeight,
            0.1,
            100
        );
        camera.position.set(0, 0.5, 2.5); // Slightly further back for better rotation view

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;
        mountNode.appendChild(renderer.domElement);

        // ===== ORBIT CONTROLS =====
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // Smooth inertia
        controls.dampingFactor = 0.05;
        controls.enableZoom = true; // Allow mouse wheel zoom
        controls.enablePan = false; // Disable panning (keep dish centered)
        controls.minDistance = 1.5; // Prevent zooming too close
        controls.maxDistance = 5;   // Prevent zooming too far
        controls.autoRotate = false; // Disable auto-rotate when user interacts

        // Optional: Limit vertical angle to prevent flipping under the plate
        controls.maxPolarAngle = Math.PI / 1.5; // Don't go below the "floor"

        controlsRef.current = controls;

        // ===== LIGHTING =====
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xffecd2, 0.5);
        fillLight.position.set(-5, 0, -5);
        scene.add(fillLight);

        if (!dish?.assets || !Array.isArray(dish.assets)) {
            setError('Dish data not loaded properly');
            setIsLoading(false);
            return;
        }


        // ===== LOAD MODEL =====
        const glbUrl = dish.assets.find(a => a.asset_type === 'glb')?.file_url;

        if (!glbUrl) {
            setError('No 3D model available');
            setIsLoading(false);
            return;
        }

        const loader = new GLTFLoader();
        let model: THREE.Group | null = null;

        loader.load(
            hardcodedUsdzUrl,
            (gltf) => {
                if (isCleaningUpRef.current) return;

                model = gltf.scene;

                // Center and scale
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 1.5 / maxDim;
                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));
                model.position.y += 0; // Keep centered or adjust as needed

                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                scene.add(model);

                // ===== INITIAL CAMERA ANGLE =====
                // This is the key part - adjust these values to change initial view

                // For food: Look from above at 45° angle (like a bird looking down)
                camera.position.set(0, 1.8, 2.2);    // X (left/right), Y (up/down), Z (close/far)
                controls.target.set(0, 0.2, 0);       // Focus point (slightly above bottom)
                controls.autoRotate = false;          // Don't spin automatically
                controls.update();

                setIsLoading(false);
                trackEvent('3d_model_loaded');
            },
            // ... rest of loader code
        );

        // ===== ANIMATION LOOP =====
        const animate = () => {
            if (isCleaningUpRef.current) return;
            animationIdRef.current = requestAnimationFrame(animate);

            // Update controls (required for damping to work)
            controls.update();

            renderer.render(scene, camera);
        };
        animate();

        // ===== RESIZE HANDLER =====
        const handleResize = () => {
            if (!mountNode || !rendererRef.current) return;
            const width = mountNode.clientWidth;
            const height = mountNode.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // ===== CLEANUP =====
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

            scene.traverse((object) => {
                if ((object as THREE.Mesh).geometry) {
                    (object as THREE.Mesh).geometry.dispose();
                }
                const mat = (object as THREE.Mesh).material;
                if (mat) {
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else mat.dispose();
                }
            });
        };
    }, [dish.id, trackEvent]);

    return (
        <div className="space-y-4">
            {/* Add cursor-grab classes for better UX */}
            <div
                ref={containerRef}
                className="w-full h-96 bg-gray-100 rounded-lg relative overflow-hidden cursor-grab active:cursor-grabbing"
                aria-label="3D dish viewer - click and drag to rotate"
            >
                {isLoading && dish && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
                        <div className="text-center">
                            <LoadingSpinner />
                            <p className="mt-2 text-gray-600 text-sm">Loading 3D model...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 z-10 p-4">
                        <div className="text-red-500 text-lg font-medium mb-2">⚠️ {error}</div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 text-sm"
                        >
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            {/* {capabilities.isARSupported && <ARButton dish={dish} />} */}
            {/* In the return statement of DishViewer: */}
            {(capabilities.isARSupported || isIOS || isAndroid) && (
                <ARButton
                    dish={dish}
                // isARSupported={capabilities.isARSupported}
                />
            )}

            {!capabilities.isARSupported && !isIOS && !isAndroid && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
                    <strong>📱 AR Not Available:</strong> Use an iOS device (iOS 12+) or Android with Chrome/WebXR support.
                </div>
            )}
        </div>
    );
};

export default DishViewer;