/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["11px", "15px"],
        "xs": ["13px", "18px"],
        "sm": ["15px", "22px"],
        "base": ["17px", "26px"],
        "lg": ["19px", "28px"],
        "xl": ["21px", "30px"],
        "2xl": ["26px", "34px"],
        "3xl": ["32px", "38px"],
        "4xl": ["38px", "44px"],
      },
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
        "swiftui-bouncy": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        "swiftui-spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "swiftui-snappy": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "swiftui-smooth": "cubic-bezier(0.25, 1, 0.5, 1)",
        "swiftui-gentle": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "swiftui-pop": "swiftui-spring-pop 320ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        "swiftui-slide-up": "swiftui-fade-slide-up 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "swiftui-stagger": "swiftui-stagger-in 220ms cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "swiftui-ring": "swiftui-pulse-ring 2s infinite cubic-bezier(0.2, 0.8, 0.2, 1)",
        "swiftui-glow": "swiftui-glow-pulse 2.4s infinite ease-in-out",
        "keyframe-fade-up": "keyframe-fade-in-up 350ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "keyframe-scale": "keyframe-scale-in 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
      },
    },
  },
  plugins: [],
}
