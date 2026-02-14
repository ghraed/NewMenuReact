/**
 * Utility function to merge Tailwind CSS classes
 * Similar to clsx but with Tailwind-specific optimizations
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}