import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // StreamVault palette — "night reel" theme
        reel: {
          950: "#0B0D14", // near-black indigo, base background
          900: "#111420",
          800: "#181C2C",
          700: "#232840",
          600: "#343B5C",
        },
        marquee: {
          DEFAULT: "#E8B95B", // marquee-bulb gold, primary accent
          dim: "#9C7A38",
          bright: "#F6D488",
        },
        signal: {
          red: "#D9534F", // rec-light red, used sparingly (live/limits)
        },
        paper: "#EDE9E0", // warm off-white for body text
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
      backgroundImage: {
        "film-grain":
          "radial-gradient(circle at 1px 1px, rgba(232,185,91,0.06) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
export default config;
