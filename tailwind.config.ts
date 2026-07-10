import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.2,0.9,0.25,1)",
        "slide-in-up": "slideInUp 0.35s cubic-bezier(0.2,0.9,0.25,1)",
        "logo-pop": "logoPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-up": "fadeUp 0.5s ease-out both",
        "blob-drift": "blobDrift 8s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        slideInUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        logoPop: {
          "0%":   { transform: "scale(0.5) translateY(12px)", opacity: "0" },
          "70%":  { transform: "scale(1.08) translateY(-4px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)",       opacity: "1" },
        },
        fadeUp: {
          from: { transform: "translateY(20px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        blobDrift: {
          from: { transform: "translate(0, 0) scale(1)" },
          to:   { transform: "translate(30px, -20px) scale(1.08)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
