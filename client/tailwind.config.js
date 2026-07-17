/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Color de marca del centro, inyectado como variable CSS desde Shell.
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
