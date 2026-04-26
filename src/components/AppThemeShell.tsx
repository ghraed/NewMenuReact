import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import FixedBackground from './FixedBackground';
import ThemeToggle from './Guest/ThemeToggle';
import { getAppThemeStyle } from './Guest/guestTheme';
import { useAppTheme } from '../hooks/useGuestTheme';
import LanguageToggle from './LanguageToggle';
import { useOrderCart } from '../contexts/useOrderCart';

const TRANSITION_NAME = 'app-theme-shell';
const REVEAL_DURATION_MS = 650;
const MOBILE_BREAKPOINT_PX = 768;

interface RevealCircleState {
  id: number;
  radius: number;
}

interface AppThemeShellProps {
  children: ReactNode;
}

const shouldUseLightweightThemeTransition = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  return [
    window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`),
    window.matchMedia('(pointer: coarse)'),
    window.matchMedia('(prefers-reduced-motion: reduce)'),
  ].some((query) => query.matches);
};

const AppThemeShell: React.FC<AppThemeShellProps> = ({ children }) => {
  const { theme, toggleTheme } = useAppTheme();
  const location = useLocation();
  const { restaurant } = useOrderCart();
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

    if (shouldUseLightweightThemeTransition()) {
      toggleTheme();
      return;
    }

    const root = document.documentElement;
    const revealRadius = Math.hypot(window.innerWidth, window.innerHeight);
    const revealX = window.innerWidth;
    const revealY = 0;

    root.style.setProperty('--app-theme-reveal-x', `${revealX}px`);
    root.style.setProperty('--app-theme-reveal-y', `${revealY}px`);
    root.style.setProperty('--app-theme-reveal-radius', `${revealRadius}px`);

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

  const isGuestRoute = (
    location.pathname === '/'
    || location.pathname.startsWith('/menu')
    || location.pathname.startsWith('/dish/')
    || location.pathname === '/order/review'
  );
  const showLanguageToggle = !isGuestRoute || restaurant?.feature_flags?.multi_language !== false;

  return (
    <div
      className="relative min-h-screen bg-bg0 text-text transition-colors duration-500"
      style={{
        ...getAppThemeStyle(theme),
        viewTransitionName: TRANSITION_NAME,
      }}
      data-app-theme-shell
      data-theme={theme}
    >
      <FixedBackground />

      {revealCircle ? (
        <div
          key={revealCircle.id}
          aria-hidden="true"
          className={`pointer-events-none fixed rounded-full border-2 transition-transform transition-opacity ease-fluid ${isRevealActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
          style={{
            left: `${window.innerWidth - revealCircle.radius}px`,
            top: `${-revealCircle.radius}px`,
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

      {showLanguageToggle ? <LanguageToggle /> : null}
      <ThemeToggle theme={theme} onToggle={handleThemeToggle} />

      <div className="relative min-h-screen">{children}</div>
    </div>
  );
};

export default AppThemeShell;
