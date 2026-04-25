declare module 'three';
declare module 'three/examples/jsm/loaders/GLTFLoader';
declare module 'three/examples/jsm/controls/OrbitControls';
declare module 'three/examples/jsm/webxr/ARButton';
declare module 'three/examples/jsm/Addons.js';

declare type XRReferenceSpace = unknown;
declare type XRHitTestSource = unknown;
declare type XRPoseLike = {
  transform: {
    matrix: ArrayLike<number>;
  };
};
declare type XRFrame = {
  getHitTestResults: (source: XRHitTestSource) => Array<{
    getPose: (space: XRReferenceSpace) => XRPoseLike | null;
  }>;
};
