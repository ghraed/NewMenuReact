import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg0: 'rgb(var(--color-bg0) / <alpha-value>)',
        bg1: 'rgb(var(--color-bg1) / <alpha-value>)',
        gold: 'rgb(var(--color-gold) / <alpha-value>)',
        gold2: 'rgb(var(--color-gold2) / <alpha-value>)',
        sage: 'rgb(var(--color-sage) / <alpha-value>)',
        spicy: 'rgb(var(--color-spicy) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / 0.06)',
        panel2: 'rgb(var(--color-panel) / 0.1)',
        stroke: 'rgb(var(--color-panel) / 0.14)',
        text: 'rgb(var(--color-text) / 0.92)',
        muted: 'rgb(var(--color-text) / 0.7)',
        muted2: 'rgb(var(--color-text) / 0.55)',
      },
      boxShadow: {
        lux: '0 22px 60px rgba(0,0,0,.55)',
        lux2: '0 10px 30px rgba(0,0,0,.35)',
      },
      borderRadius: {
        xl2: '22px',
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
};

export default config;
