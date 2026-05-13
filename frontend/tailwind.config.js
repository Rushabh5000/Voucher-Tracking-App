/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50:  "#E8F5EE",
          100: "#C5E8D4",
          200: "#8FD1AC",
          300: "#5ABB84",
          400: "#2FAF6A",
          500: "#1A6B4A",
          600: "#155C3E",
          700: "#0F4D33",
          800: "#093D28",
          900: "#042D1D",
        },
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
