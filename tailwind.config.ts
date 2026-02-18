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
          text: 'hsl(var(--lg-text))',
          bgA: 'hsl(var(--lg-bg-a))',
          bgB: 'hsl(var(--lg-bg-b))',
          bgC: 'hsl(var(--lg-bg-c))',
        },
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
};

export default config;
