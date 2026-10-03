export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Public Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#14232E', soft: '#223645', line: '#2F4757' },
        paper: '#F3F5F4',
        brand: { DEFAULT: '#0E7C74', dark: '#0A5F59', tint: '#E3F1EF' },
        warn: '#B45309', danger: '#B42318', ok: '#1B7F46',
      },
    },
  },
  plugins: [],
};
