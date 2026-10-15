/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FAF8F5',
          100: '#F5F0EB',
          200: '#EBE2D8',
          300: '#DCCFC0',
          800: '#3D342B',
          900: '#2A241E',
        },
      },
    },
  },
  plugins: [],
};
