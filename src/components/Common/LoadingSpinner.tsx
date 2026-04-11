import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'light' | 'dark';
export type SpinnerType = 'dots' | 'ring' | 'pulse' | 'bars' | 'infinity';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  type?: SpinnerType;
  text?: string;
  fullPage?: boolean;
  inline?: boolean;
  className?: string;
  color?: string;
  textColor?: string;
  percentage?: number;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const variantClasses: Record<SpinnerVariant, string> = {
  primary: 'text-gold',
  secondary: 'text-muted',
  success: 'text-sage',
  warning: 'text-gold2',
  danger: 'text-spicy',
  light: 'text-text',
  dark: 'text-muted2',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  type = 'dots',
  text,
  fullPage = false,
  inline = false,
  className = '',
  color,
  textColor,
  percentage,
}) => {
  const spinnerColor = color || variantClasses[variant];

  const renderSpinner = () => {
    switch (type) {
      case 'ring':
        return (
          <div className={cn('relative', sizeClasses[size])}>
            <div className={cn('absolute inset-0 rounded-full border-4 border-current opacity-25', spinnerColor)} />
            <div className={cn('absolute inset-0 rounded-full border-4 border-t-transparent animate-spin', spinnerColor)} />
          </div>
        );

      case 'pulse':
        return <div className={cn('rounded-full animate-pulse', spinnerColor, sizeClasses[size])} style={{ backgroundColor: 'currentColor' }} />;

      case 'bars':
        return (
          <div className={cn('flex items-center justify-center space-x-1', sizeClasses[size])}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn('h-full w-1/4 animate-bounce bg-current', spinnerColor)}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </div>
        );

      case 'infinity':
        return (
          <div className={cn('relative', sizeClasses[size])}>
            <div className={cn('absolute inset-0 rounded-full border-4 border-current opacity-25', spinnerColor)} />
            <div
              className={cn('absolute inset-0 rounded-full border-4 border-l-transparent border-r-transparent animate-spin', spinnerColor)}
              style={{ animationDuration: '1.5s' }}
            />
          </div>
        );

      default:
        return (
          <div className={cn('relative', sizeClasses[size])}>
            <div className="absolute inset-0 flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn('absolute h-1/3 w-1/3 animate-ping rounded-full bg-current', spinnerColor)}
                  style={{
                    top: `${25 * Math.sin((i * 2 * Math.PI) / 3)}%`,
                    left: `${25 * Math.cos((i * 2 * Math.PI) / 3)}%`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <div className={cn('h-full w-full rounded-full opacity-30', spinnerColor)} style={{ backgroundColor: 'currentColor' }} />
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        !inline && 'flex',
        inline && 'inline-flex',
        fullPage && 'fixed inset-0 z-50',
        className
      )}
    >
      <div className="relative">
        {renderSpinner()}

        {percentage !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn('text-xs font-bold', textColor || 'text-muted')}
              style={{ fontSize: size === 'xs' ? '0.5rem' : '0.75rem' }}
            >
              {percentage}%
            </span>
          </div>
        )}
      </div>

      {text && (
        <div
          className={cn(
            'mt-3 text-center',
            textColor || 'text-muted',
            size === 'xs' && 'text-xs',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base',
            size === 'lg' && 'text-lg',
            size === 'xl' && 'text-xl'
          )}
        >
          {text}
        </div>
      )}

      {fullPage && <div className="absolute inset-0 -z-10 bg-bg0/75 backdrop-blur-sm" />}
    </div>
  );
};

export default LoadingSpinner;

export const PageLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => {
  const { t } = useTranslation();

  return <LoadingSpinner size="lg" type="ring" fullPage text={t('common.loading')} variant="primary" {...props} />;
};

export const ButtonLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => (
  <LoadingSpinner size="sm" type="dots" inline variant="light" {...props} />
);

export const CardLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => {
  const { t } = useTranslation();

  return <LoadingSpinner size="md" type="pulse" text={t('common.loadingContent')} variant="secondary" {...props} />;
};

export const TableLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => {
  const { t } = useTranslation();

  return <LoadingSpinner size="md" type="bars" text={t('common.loadingData')} variant="primary" {...props} />;
};
