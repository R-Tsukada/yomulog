/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // YomuLog color palette (Zenn-inspired)
        primary: "#3ea8ff",
        "primary-dark": "#2b8fd9",
        accent: "#22c55e",
        danger: "#ef4444",
        "bg-main": "#ffffff",
        "bg-sub": "#f1f5f9",
        "bg-hover": "#f0f9ff",
        "text-primary": "#1a1a2e",
        "text-secondary": "#93a5b6",
        "border-light": "#e8edf3",
        "border-main": "#d4eafc",
      },
    },
  },
  plugins: [],
};
