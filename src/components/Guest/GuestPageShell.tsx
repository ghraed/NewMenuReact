import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import ThemeToggle from './ThemeToggle';
import { getGuestThemeStyle } from './guestTheme';

interface GuestPageShellProps {
  children: ReactNode;
}

const TRANSITION_NAME = 'guest-theme-shell';
const REVEAL_X = '0px';
const REVEAL_DURATION_MS = 650;

interface RevealCircleState {
  id: number;
  radius: number;
}

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme, toggleTheme } = useGuestTheme();
  const isTransitioningRef = useRef(false);
  const hideRevealTimeoutRef = useRef<number | null>(null);
  const revealIdRef = useRef(0);
  const [revealCircle, setRevealCircle] = useState<RevealCircleState | null>(null);
  const [isRevealActive, setIsRevealActive] = useState(false);

  useEffect(() => {
    return () => {
      if (hideRevealTimeoutRef.current !== null) {
        window.clearTimeout(hideRevealTimeoutRef.current);
      }
    };
  }, []);

  const handleThemeToggle = () => {
    if (typeof window === 'undefined') {
      toggleTheme();
      return;
    }

    const root = document.documentElement;

    root.style.setProperty('--guest-theme-reveal-x', REVEAL_X);
    root.style.setProperty('--guest-theme-reveal-y', `${window.innerHeight}px`);
    const revealRadius = Math.hypot(window.innerWidth, window.innerHeight);
    root.style.setProperty('--guest-theme-reveal-radius', `${revealRadius}px`);

    revealIdRef.current += 1;
    setRevealCircle({
      id: revealIdRef.current,
      radius: revealRadius,
    });
    setIsRevealActive(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsRevealActive(true);
      });
    });

    if (hideRevealTimeoutRef.current !== null) {
      window.clearTimeout(hideRevealTimeoutRef.current);
    }
    hideRevealTimeoutRef.current = window.setTimeout(() => {
      setIsRevealActive(false);
      setRevealCircle(null);
      hideRevealTimeoutRef.current = null;
    }, REVEAL_DURATION_MS + 120);

    if (typeof document.startViewTransition !== 'function' || isTransitioningRef.current) {
      toggleTheme();
      return;
    }

    isTransitioningRef.current = true;

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        toggleTheme();
      });
    });

    transition.finished.finally(() => {
      isTransitioningRef.current = false;
    });
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans transition-colors duration-500"
      style={{
        ...getGuestThemeStyle(theme),
        viewTransitionName: TRANSITION_NAME,
      }}
      data-guest-theme-shell
      data-theme={theme}
    >
      {revealCircle ? (
        <div
          key={revealCircle.id}
          aria-hidden="true"
          className={`pointer-events-none fixed rounded-full border-2 transition-transform transition-opacity ease-fluid ${isRevealActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
          style={{
            left: `${-revealCircle.radius}px`,
            bottom: `${-revealCircle.radius}px`,
            width: `${revealCircle.radius * 2}px`,
            height: `${revealCircle.radius * 2}px`,
            borderColor: 'color-mix(in srgb, var(--guest-accent) 78%, white 22%)',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--guest-panel) 24%, transparent), 0 0 32px color-mix(in srgb, var(--guest-accent) 20%, transparent)',
            transformOrigin: 'center',
            transitionDuration: `${REVEAL_DURATION_MS}ms`,
            zIndex: 60,
          }}
        />
      ) : null}

      <ThemeToggle theme={theme} onToggle={handleThemeToggle} />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GuestPageShell;
