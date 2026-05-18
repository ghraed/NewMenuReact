import React from 'react';

interface PageSkeletonProps {
  rows?: number;
  columns?: 1 | 2 | 3;
  className?: string;
  loadingText?: string;
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({ rows = 6, columns = 1, className, loadingText }) => {
  const gridClass = columns === 3
    ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
    : columns === 2
      ? 'grid gap-4 md:grid-cols-2'
      : 'space-y-3';

  return (
    <div className={className}>
      <div className={gridClass} aria-live="polite" aria-busy="true">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`page-skeleton-${index + 1}`}
            className="animate-pulse rounded-2xl border border-stroke bg-bg1/55 p-4"
          >
            <div className="h-36 rounded-[18px] bg-bg1/80" />
            <div className="mt-4 h-4 w-3/4 rounded-full bg-bg1/80" />
            <div className="mt-3 h-3 w-full rounded-full bg-bg1/80" />
            <div className="mt-2 h-3 w-5/6 rounded-full bg-bg1/80" />
            <div className="mt-4 flex items-center justify-between">
              <div className="h-8 w-20 rounded-full bg-bg1/80" />
              <div className="h-8 w-24 rounded-full bg-bg1/80" />
            </div>
          </div>
        ))}
      </div>
      {loadingText ? (
        <p className="mt-3 text-center text-sm text-muted">{loadingText}</p>
      ) : null}
    </div>
  );
};

export default PageSkeleton;
