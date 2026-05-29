import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        score: {
          high: '#16a34a',   // verde — score >= 80
          mid: '#eab308',    // amarelo — score 50-79
          low: '#9ca3af',    // cinza — score < 50
          none: '#cbd5e1',   // sem análise
        },
      },
    },
  },
  plugins: [],
};

export default config;
