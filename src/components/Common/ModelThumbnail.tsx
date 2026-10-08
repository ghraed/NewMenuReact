import React from 'react';
import '@google/model-viewer';

const ModelViewer = 'model-viewer' as React.ElementType;

const ModelThumbnail: React.FC<{ src: string; onError: () => void }> = ({ src, onError }) => (
          <ModelViewer
            src={src}
            camera-target="auto auto auto"
            camera-orbit="0deg 75deg auto"
            min-camera-orbit="auto auto auto"
            max-camera-orbit="auto auto auto"
            field-of-view="26deg"
            bounds="tight"
            environment-image="neutral"
            shadow-intensity="0"
            interaction-prompt="none"
            disable-zoom
            disable-pan
            onError={onError}
            style={{ width: '100%', height: '100%' }}
          />
);

export default ModelThumbnail;
