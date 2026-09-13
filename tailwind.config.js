/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          active: "var(--color-primary-active)",
          disabled: "var(--color-primary-disabled)",
        },
        ink: "var(--color-ink)",
        body: {
          DEFAULT: "var(--color-body)",
          strong: "var(--color-body-strong)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          soft: "var(--color-muted-soft)",
        },
        hairline: {
          DEFAULT: "var(--color-hairline)",
          soft: "var(--color-hairline-soft)",
        },
        canvas: "var(--color-canvas)",
        surface: {
          soft: "var(--color-surface-soft)",
          card: "var(--color-surface-card)",
          cream: "var(--color-surface-cream-strong)",
          dark: "var(--color-surface-dark)",
          "dark-elevated": "var(--color-surface-dark-elevated)",
          "dark-soft": "var(--color-surface-dark-soft)",
        },
        on: {
          primary: "#ffffff",
          dark: "#faf9f5",
          "dark-soft": "#a09d96",
        },
        accent: {
          teal: "#5db8a6",
          amber: "#e8a55a",
        },
        success: "#5db872",
        warning: "#d4a017",
        error: "#c64545",
      },
      fontFamily: {
        serif: ["Copernicus", "Tiempos Headline", "Cormorant Garamond", "EB Garamond", "Georgia", "serif"],
        sans: ["StyreneB", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
        pill: "9999px",
      },
      transitionTimingFunction: {
        "apple-spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "apple-ease": "cubic-bezier(0.25, 1, 0.5, 1)",
        "apple-snappy": "cubic-bezier(0.16, 1, 0.3, 1)",
        "apple-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "keyframe-fade-up": "keyframe-fade-in-up 350ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "keyframe-fade-down": "keyframe-fade-in-down 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "keyframe-scale": "keyframe-scale-in 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "keyframe-slide": "keyframe-slide-right 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "keyframe-glow": "keyframe-pulse-glow 2.2s infinite ease-in-out",
        "keyframe-shimmer": "keyframe-shimmer 1.8s infinite",
      },
    },
  },
  plugins: [],
}
