/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Onsen-town color palette (indigo / vermillion / gold / cream)
        electric: {
          // vermillion (朱色) - primary actions
          DEFAULT: "#d9432e",
          50: "#fdf0ec",
          100: "#fad9cd",
          200: "#f4b195",
          300: "#ed875c",
          400: "#e66935",
          500: "#d9432e",
          600: "#b8341f",
          700: "#8f2818",
          800: "#661c11",
          900: "#40110a",
        },
        neon: {
          // gold (金) - success/connected states
          DEFAULT: "#c9a227",
          50: "#fbf6e6",
          100: "#f3e6b9",
          200: "#e9d488",
          300: "#dfc158",
          400: "#d6b23a",
          500: "#c9a227",
          600: "#a5841f",
          700: "#7d6418",
          800: "#56450f",
          900: "#302709",
        },
        cyber: {
          // indigo (藍) - secondary accent
          DEFAULT: "#3d6fac",
          50: "#eaf0f8",
          100: "#c8d8ec",
          200: "#a2bede",
          300: "#7ba3cf",
          400: "#5c8cc3",
          500: "#3d6fac",
          600: "#2f5789",
          700: "#234066",
          800: "#182c47",
          900: "#0d1829",
        },
        dark: {
          DEFAULT: "#0d0f16",
          50: "#262c40",
          100: "#1c2130",
          200: "#161a26",
          300: "#10131c",
          400: "#0d0f16",
          500: "#08090d",
        },
        surface: {
          DEFAULT: "#1c2130",
          elevated: "#262c40",
          overlay: "rgba(28, 33, 48, 0.90)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        display: ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        headline: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
      },
      boxShadow: {
        "glow-electric":
          "0 0 20px rgba(217, 67, 46, 0.4), 0 0 40px rgba(217, 67, 46, 0.2)",
        "glow-electric-sm": "0 0 10px rgba(217, 67, 46, 0.3)",
        "glow-neon":
          "0 0 20px rgba(201, 162, 39, 0.4), 0 0 40px rgba(201, 162, 39, 0.2)",
        "glow-neon-sm": "0 0 10px rgba(201, 162, 39, 0.3)",
        "glow-cyber":
          "0 0 20px rgba(61, 111, 172, 0.4), 0 0 40px rgba(61, 111, 172, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
      },
      backdropBlur: {
        glass: "12px",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(217, 67, 46, 0.4), 0 0 40px rgba(217, 67, 46, 0.2)",
          },
          "50%": {
            boxShadow:
              "0 0 30px rgba(217, 67, 46, 0.6), 0 0 60px rgba(217, 67, 46, 0.3)",
          },
        },
      },
      screens: {
        tablet: "768px",
        desktop: "1024px",
      },
    },
  },
  plugins: [],
};
