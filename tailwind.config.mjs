/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    screens: {
      sm: "640px",
      md: "760px",
      lg: "760px",
      xl: "1280px",
      "2xl": "1536px"
    },
    extend: {
      colors: {
        ivory: "#fbfaf6",
        veil: "#f1eee6",
        champagne: "#b08a4d",
        rosegold: "#7d3042",
        taupe: "#6f6860",
        ink: "#22201d"
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        body: ["Inter", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 24px 80px rgba(74, 57, 49, 0.12)"
      }
    }
  },
  plugins: []
};
