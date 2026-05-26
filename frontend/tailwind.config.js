/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          blue: '#00f0ff',
          pink: '#ff007f',
          neon: '#39ff14',
          dark: '#0a0b10',
          panel: '#121420',
          border: '#1f2438'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(0, 240, 255, 0.4)',
        'glow-green': '0 0 15px rgba(57, 255, 20, 0.4)',
        'glow-pink': '0 0 15px rgba(255, 0, 127, 0.4)',
      }
    },
  },
  plugins: [],
}
