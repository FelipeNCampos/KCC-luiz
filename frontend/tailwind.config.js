/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        oak: {
          coffee: "#55311c",
          taupe: "#8c7569",
          muted: "#736055",
          page: "#f5f1ee",
          surface: "#faf8f6",
          panel: "#f9f7f5",
          border: "#e5e0dc",
          borderStrong: "#d9d0ca",
          danger: "#8a3d1b",
          dangerBg: "#fff1ea",
        },
      },
      boxShadow: {
        oak: "0 12px 30px -18px rgba(85, 49, 28, 0.35)",
        oakLg: "0 22px 55px -28px rgba(85, 49, 28, 0.45)",
      },
    },
  },
  plugins: [],
};
