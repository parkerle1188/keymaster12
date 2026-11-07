/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0b0c', 900: '#121214', 850: '#17171a', 800: '#1d1d21', 700: '#2a2a30', 600: '#3a3a42' },
        accent: { DEFAULT: '#FF7900', soft: '#ff9a3d', dim: '#7a3a00' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
