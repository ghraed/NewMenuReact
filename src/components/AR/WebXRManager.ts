// components/AR/WebXRManager.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';

export const startWebXRSession = async (glbUrl: string) => {
    // Create scene
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true; // Critical for WebXR
    
    document.body.appendChild(renderer.domElement);
    
    // Add AR Button with hit-testing
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
    });
    document.body.appendChild(arButton);

    // Lighting for AR (matches real world)
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(directionalLight);

    // Load model
    const loader = new GLTFLoader();
    const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.visible = false;
    scene.add(reticle);

    let model: any = null;
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    // Controller for placement
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
        if (reticle.visible && model) {
            // Place model at reticle position
            model.position.setFromMatrixPosition(reticle.matrix);
            model.visible = true;
        }
    });
    scene.add(controller);

    // Animation loop
    renderer.setAnimationLoop((_timestamp: number, frame: XRFrame) => {
        if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();
            
            if (!hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((refSpace: any) => {
                    session.requestHitTestSource({ space: refSpace }).then((source: any) => {
                        hitTestSource = source;
                    });
                });
                hitTestSourceRequested = true;
            }

            if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace!);
                    if (pose) {
                        reticle.visible = true;
                        reticle.matrix.fromArray(pose.transform.matrix);
                    }
                } else {
                    reticle.visible = false;
                }
            }
        }

        renderer.render(scene, camera);
    });

    // Load GLB
    loader.load(glbUrl, (gltf: any) => {
        model = gltf.scene;
        
        // Auto-scale for AR (real-world size approximation)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 0.3 / maxDim; // 30cm max dimension (plate size)
        model.scale.setScalar(scale);
        
        model.visible = false; // Hidden until placed
        scene.add(model);
    });

    // Cleanup on exit
    renderer.xr.addEventListener('sessionend', () => {
        renderer.dispose();
        document.body.removeChild(renderer.domElement);
        document.body.removeChild(arButton);
    });
};
