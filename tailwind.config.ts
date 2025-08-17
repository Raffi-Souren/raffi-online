import type { Config } from "tailwindcss"
import defaultConfig from "shadcn/ui/tailwind.config"

const config: Config = {
  ...defaultConfig,
  content: [
    ...defaultConfig.content,
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    ...defaultConfig.theme,
    extend: {
      ...defaultConfig.theme.extend,
      colors: {
        ...defaultConfig.theme.extend.colors,
        background: "#0a0a0a",
        foreground: "#fafafa",
        accent: "#00ffff",
        secondary: "#1a1a1a",
        muted: "#888888",
        border: "#333333",
      },
      fontFamily: {
        heading: ["Space Grotesk", "monospace"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        typewriter: "typewriter 4s steps(40) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        typewriter: {
          "0%, 50%": { width: "0" },
          "100%": { width: "100%" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #00ffff" },
          "100%": { boxShadow: "0 0 20px #00ffff, 0 0 30px #00ffff" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [...defaultConfig.plugins, require("tailwindcss-animate")],
}

export default config
