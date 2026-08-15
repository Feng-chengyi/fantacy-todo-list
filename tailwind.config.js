/** @type {import('tailwindcss').Config} */
module.exports = {
  // 跟随系统深浅色（PRD P0-13），无需手动切换
  darkMode: 'media',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx}',
    './src/pet/index.html',
    './src/pet/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
