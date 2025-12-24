/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 12px 40px rgba(10, 37, 64, 0.25)",
      },
    },
  },
  plugins: [],
};
