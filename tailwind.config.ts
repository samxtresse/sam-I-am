import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "375px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // Sibling brand: maroon + cream. Gold replaces sage so the personal
        // surface reads warmer / less corporate than the finance tracker.
        maroon: { DEFAULT: "#5C2F2E", 700: "#4A2524", 800: "#3A1D1C" },
        cream: { DEFAULT: "#EDDCC5", 50: "#FAF4EA", 100: "#F8F0E2", 200: "#F1E5CF", 300: "#E5D2B6" },
        ink: { DEFAULT: "#2D1F1A", muted: "#6B5950" },
        gold: { DEFAULT: "#B88A3E", 600: "#9A7232", 100: "#EFD9A8" },
        gain: "#3F7D5A",
        loss: "#B85A4A",
        warn: "#C99544",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(45,31,26,0.08), 0 1px 2px rgba(45,31,26,0.04)",
        lift: "0 6px 16px rgba(45,31,26,0.10)",
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        tap: "44px",
      },
    },
  },
  plugins: [],
};
export default config;
