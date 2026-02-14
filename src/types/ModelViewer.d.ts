// components/AR/ARButton.tsx
import '@google/model-viewer';

interface ARButtonProps {
    dish: {
        assets: Array<{ asset_type: string; file_url: string }>;
    };
}

// Extend JSX interface locally
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

const ARButton: React.FC<ARButtonProps> = ({ dish }) => {
    const glbUrl = dish.assets.find(a => a.asset_type === 'glb')?.file_url;
    const usdzUrl = dish.assets.find(a => a.asset_type === 'usdz')?.file_url;

    if (!glbUrl) return null;

    return (
        // @ts-ignore - if the above doesn't work, use this temporarily
        <ModelViewer
            src={glbUrl}
            ios-src={usdzUrl}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            touch-action="pan-y"
            style={{ width: '100%', height: '400px' }}
            alt="3D Dish Model"
            shadow-intensity="1"
            exposure="0.8"
        >
            <button 
                slot="ar-button"
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg"
            >
                👋 View in AR
            </button>
        </ModelViewer>
    );
};

export default ARButton;