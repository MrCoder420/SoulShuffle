/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#481639', // Deep Plum
          light: '#FCEEF5', // Soft Pink
          accent: '#D36B93', // Vibrant Pink Accent
          DEFAULT: '#481639',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#161616', // Cleaner dark mode background
          card: '#F8F8F8', // Slightly off-white for cards
          cardDark: '#1E1E1E',
        }
      },
      fontFamily: {
        heading: ['System'], // We'll rely on font-weight and clean sans-serif
        body: ['System'],
      }
    },
  },
  plugins: [],
}