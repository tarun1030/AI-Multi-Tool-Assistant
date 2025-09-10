/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Poppins', 'sans-serif'],
        'mono': ['Fira Code', 'monospace'],
      },
      colors: {
        'violet': {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        'neon-pink': '#ff6bd6',
        'cyan': '#00f5d4',
        'dark-bg': '#000000',
        'dark-surface': '#0a0a0f',
        'gradient-start': '#6c63ff',
        'gradient-end': '#9f7aea',
      },
      boxShadow: {
        'glow': '0 0 15px rgba(167, 139, 250, 0.5)',
        'glow-lg': '0 0 25px rgba(167, 139, 250, 0.8)',
        'glow-xl': '0 0 35px rgba(167, 139, 250, 1)',
        'neon': '0 0 20px rgba(255, 107, 214, 0.6)',
        'cyan-glow': '0 0 20px rgba(0, 245, 212, 0.6)',
        'violet-glow': '0 0 30px rgba(139, 92, 246, 0.7)',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
      },
    },
  },
  plugins: [],
};