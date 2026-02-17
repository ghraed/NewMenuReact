import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lg: {
          primary: 'hsl(var(--lg-primary))',
          secondary: 'hsl(var(--lg-secondary))',
          tertiary: 'hsl(var(--lg-tertiary))',
          bg: 'hsl(var(--lg-bg))',
          surface: 'hsl(var(--lg-surface))',
          border: 'hsl(var(--lg-border))',
          text: 'hsl(var(--lg-text))',
          muted: 'hsl(var(--lg-muted))',
        },
      },
      boxShadow: {
        'glass-soft': '0 18px 60px rgba(0, 0, 0, 0.16)',
        'glass-strong': '0 28px 80px rgba(0, 0, 0, 0.24)',
        'glow-primary': '0 0 0 1px rgba(120, 190, 255, 0.18), 0 14px 35px rgba(120, 190, 255, 0.35)',
        'glow-secondary': '0 0 0 1px rgba(255, 145, 213, 0.2), 0 14px 35px rgba(255, 145, 213, 0.32)',
        'glow-tertiary': '0 0 0 1px rgba(123, 230, 200, 0.2), 0 14px 35px rgba(123, 230, 200, 0.32)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backdropBlur: {
        '3xl': '56px',
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
};

export default config;
