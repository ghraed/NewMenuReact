import React from 'react';
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  titleId?: string;
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ titleId, eyebrow, title, description, aside }) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--guest-accent)]">{eyebrow}</p>
        <h1 id={titleId} className="mt-3 font-serif text-3xl leading-tight text-[var(--guest-text)] sm:text-4xl lg:text-[3.35rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--guest-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
};

export default SectionHeading;
