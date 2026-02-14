import React from 'react';
import { cn } from '../../utils/cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'light' | 'dark';
export type SpinnerType = 'dots' | 'ring' | 'pulse' | 'bars' | 'infinity';

export interface LoadingSpinnerProps {
    /** Size of the spinner */
    size?: SpinnerSize;
    /** Color variant */
    variant?: SpinnerVariant;
    /** Type of spinner animation */
    type?: SpinnerType;
    /** Optional text to display below spinner */
    text?: string;
    /** Full page overlay */
    fullPage?: boolean;
    /** Inline spinner (no flex centering) */
    inline?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Override spinner color */
    color?: string;
    /** Override text color */
    textColor?: string;
    /** Show loading percentage */
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
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    light: 'text-gray-200',
    dark: 'text-gray-800',
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
                        <div
                            className={cn(
                                'absolute inset-0 rounded-full border-4 border-current opacity-25',
                                spinnerColor
                            )}
                        />
                        <div
                            className={cn(
                                'absolute inset-0 rounded-full border-4 border-t-transparent animate-spin',
                                spinnerColor
                            )}
                        />
                    </div>
                );

            case 'pulse':
                return (
                    <div
                        className={cn(
                            'rounded-full animate-pulse',
                            spinnerColor,
                            sizeClasses[size]
                        )}
                        style={{ backgroundColor: 'currentColor' }}
                    />
                );

            case 'bars':
                return (
                    <div className={cn('flex items-center justify-center space-x-1', sizeClasses[size])}>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    'w-1/4 h-full bg-current animate-bounce',
                                    spinnerColor
                                )}
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
                        <div
                            className={cn(
                                'absolute inset-0 rounded-full border-4 border-current opacity-25',
                                spinnerColor
                            )}
                        />
                        <div
                            className={cn(
                                'absolute inset-0 rounded-full border-4 border-l-transparent border-r-transparent animate-spin',
                                spinnerColor
                            )}
                            style={{ animationDuration: '1.5s' }}
                        />
                    </div>
                );

            // Default: dots
            default:
                return (
                    <div className={cn('relative', sizeClasses[size])}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'absolute w-1/3 h-1/3 rounded-full bg-current animate-ping',
                                        spinnerColor
                                    )}
                                    style={{
                                        top: `${25 * Math.sin((i * 2 * Math.PI) / 3)}%`,
                                        left: `${25 * Math.cos((i * 2 * Math.PI) / 3)}%`,
                                        animationDelay: `${i * 0.15}s`,
                                    }}
                                />
                            ))}
                        </div>
                        <div
                            className={cn(
                                'w-full h-full rounded-full opacity-30',
                                spinnerColor
                            )}
                            style={{ backgroundColor: 'currentColor' }}
                        />
                    </div>
                );
        }
    };

    const content = (
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
                            className={cn(
                                'text-xs font-bold',
                                textColor || 'text-gray-700'
                            )}
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
                        textColor || 'text-gray-600',
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

            {fullPage && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm -z-10" />
            )}
        </div>
    );

    return content;
};

// Default export
export default LoadingSpinner;

// Pre-configured spinner components for common use cases
export const PageLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => (
    <LoadingSpinner
        size="lg"
        type="ring"
        fullPage
        text="Loading..."
        variant="primary"
        {...props}
    />
);

export const ButtonLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => (
    <LoadingSpinner
        size="sm"
        type="dots"
        inline
        variant="light"
        {...props}
    />
);

export const CardLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => (
    <LoadingSpinner
        size="md"
        type="pulse"
        text="Loading content..."
        variant="secondary"
        {...props}
    />
);

export const TableLoader: React.FC<Partial<LoadingSpinnerProps>> = (props) => (
    <LoadingSpinner
        size="md"
        type="bars"
        text="Loading data..."
        variant="primary"
        {...props}
    />
);