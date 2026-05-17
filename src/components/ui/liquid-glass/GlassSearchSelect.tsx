import React, { useEffect, useMemo, useState } from 'react';
import { cx, focusRing, glassControl } from '../../../theme/liquidGlass';
import GlassInput from './GlassInput';

interface SearchOption {
  value: string;
  label: string;
}

interface GlassSearchSelectProps {
  value: string;
  options: SearchOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

const GlassSearchSelect: React.FC<GlassSearchSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Choose option',
  searchPlaceholder = 'Search...',
  emptyText = 'No options found.',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-admin-overlay-root="true"]')) return;
      closeDropdown();
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  return (
    <div className="relative z-30" data-admin-overlay-root="true">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => {
            const nextOpen = !current;
            if (!nextOpen) {
              setQuery('');
            }
            return nextOpen;
          });
        }}
        className={cx(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left',
          glassControl,
          focusRing
        )}
        disabled={disabled}
        aria-expanded={open}
      >
        <span className="truncate text-sm text-text">
          {selectedOption?.label || placeholder}
        </span>
        <span className="shrink-0 text-muted2">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 overflow-hidden rounded-2xl border border-stroke bg-bg1 shadow-lux2">
          <div className="space-y-2 p-2">
            <GlassInput
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              leftSlot={<span>⌕</span>}
            />

            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filteredOptions.length === 0 ? (
                <div className="rounded-xl border border-stroke bg-bg1/70 px-4 py-5 text-center text-sm text-muted">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        closeDropdown();
                      }}
                      className={cx(
                        'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        isSelected ? 'border-gold/35 bg-gold/14' : 'border-stroke bg-bg1/72'
                      )}
                    >
                      <span className="truncate text-sm text-text">{option.label}</span>
                      <span className={cx('shrink-0 text-sm', isSelected ? 'text-gold2' : 'text-muted2')}>
                        {isSelected ? '✓' : '+'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GlassSearchSelect;
