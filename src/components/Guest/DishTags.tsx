import React from 'react';
import { cn } from '../../utils/cn';

interface DishTagsProps {
  tags: string[];
  activeTag?: string;
  onTagClick?: (tag: string) => void;
  className?: string;
  scrollable?: boolean;
}

const DishTags: React.FC<DishTagsProps> = ({ tags, activeTag, onTagClick, className, scrollable = true }) => {
  return (
    <div
      className={cn(
        'flex gap-2 pb-1 no-scrollbar',
        scrollable ? 'overflow-x-auto' : 'overflow-hidden',
        className
      )}
    >
      {tags.map((tag) => {
        const isActive = tag === activeTag;
        const commonClassName = cn(
          'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-300',
          onTagClick ? 'cursor-pointer' : ''
        );

        const styles = isActive
          ? {
            backgroundColor: 'var(--guest-accent)',
            borderColor: 'var(--guest-accent)',
            color: 'var(--guest-bg)',
          }
          : {
            backgroundColor: 'var(--guest-accent-soft)',
            borderColor: 'var(--guest-border)',
            color: 'var(--guest-text)',
          };

        if (onTagClick) {
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className={commonClassName}
              style={styles}
            >
              {tag}
            </button>
          );
        }

        return (
          <span key={tag} className={commonClassName} style={styles}>
            {tag}
          </span>
        );
      })}
    </div>
  );
};

export default DishTags;
