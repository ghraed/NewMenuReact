import React from 'react';

interface LuxuryScrollIndicatorProps {
  show: boolean;
  left?: string;
  bottom?: string;
}

const LuxuryScrollIndicator: React.FC<LuxuryScrollIndicatorProps> = ({
  show,
  left = '50%',
  bottom = '1rem',
}) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-30 -translate-x-1/2"
      style={{ left, bottom }}
      aria-hidden="true"
    >
      <div className="relative rounded-full border border-gold/30 bg-bg1/62 px-3 py-2 shadow-lux2 backdrop-blur">
        <span className="pointer-events-none absolute inset-0 rounded-full border border-gold/12" />
        <div className="relative flex items-center justify-center text-gold2/90">
          <svg viewBox="0 0 28 28" className="h-6 w-6">
            <rect
              x="8"
              y="3.8"
              width="12"
              height="20"
              rx="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              opacity="0.88"
            />
            <rect
              x="13.1"
              y="8"
              width="1.8"
              height="5.6"
              rx="1"
              className="animate-[mouse-wheel_1.35s_ease-in-out_infinite]"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LuxuryScrollIndicator;
