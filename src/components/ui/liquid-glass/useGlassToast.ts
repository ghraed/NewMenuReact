import { useCallback, useRef, useState } from 'react';

export interface ToastState {
  open: boolean;
  message: string;
  tone?: 'primary' | 'secondary' | 'tertiary';
  durationMs?: number;
  nonce?: number;
}

export const useGlassToast = (defaultDuration = 2200) => {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    tone: 'primary',
    durationMs: defaultDuration,
    nonce: 0,
  });
  const timeoutRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastState['tone'] = 'primary', duration = defaultDuration) => {
      setToast({ open: true, message, tone, durationMs: duration, nonce: Date.now() });

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setToast((prev) => ({ ...prev, open: false }));
      }, duration);
    },
    [defaultDuration]
  );

  return { toast, showToast, dismiss };
};
