import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          upstart: "#0AAF60",
          docusign: "#DC2C34",
          ink: "#1a1a1a",
        },
        up: {
          green: "#0AAF60",
          dark: "#078A4C",
          ink: "#0E2A47",
          soft: "#E7F7EF",
          teal: "#0DBEA8",
        },
        // DocuSign product palette (approximation for POC theming)
        ds: {
          red: "#DC2C34",
          redDark: "#B01E26",
          ink: "#13032E",
          bg: "#F6F7F9",
          line: "#E3E6EA",
          yellow: "#FFCE00",
          yellowSoft: "#FFF7CC",
          green: "#1B7F3B",
          greenSoft: "#E6F4EA",
          grayText: "#5F6368",
          blue: "#2E63E7",
          purple: "#6E45E2",
          canvas: "#FBFAF8",
        },
        // Springfield Community Bank portal palette
        bank: {
          green: "#1E7A34",
          dark: "#145326",
          soft: "#EBF5EE",
          ink: "#12261A",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        sheet: "0 1px 2px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.10)",
        card: "0 1px 2px rgba(19,3,46,0.05), 0 8px 24px rgba(19,3,46,0.06)",
        lift: "0 2px 6px rgba(19,3,46,0.08), 0 16px 40px rgba(19,3,46,0.12)",
        toast: "0 8px 30px rgba(19,3,46,0.18)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "grow-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(245,158,11,0.45)" },
          "70%": { boxShadow: "0 0 0 8px rgba(245,158,11,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0)" },
        },
        "pop-check": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "grow-x": "grow-x 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        "pop-check": "pop-check 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "sheet-up": "sheet-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "spin-slow": "spin-slow 1.1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
