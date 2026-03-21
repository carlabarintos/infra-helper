/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#2ea3f2',
        'brand-hover': '#1a8fd1',
        'brand-navy': '#0b3c5d',
        'brand-teal': '#2fd5c7',
        'surface': '#0b1e30',
        'card': '#0f2840',
      },
    },
  },
  plugins: [],
}
