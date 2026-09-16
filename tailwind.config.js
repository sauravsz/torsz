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
        "base": ["16px", "24px"],
        "lg": ["18px", "26px"],
        "xl": ["20px", "28px"],
        "2xl": ["24px", "30px"],
        "3xl": ["36px", "40px"],
        "4xl": ["48px", "52px"],
        "5xl": ["60px", "64px"],
      },
      letterSpacing: {
        "tight-hero": "-1.5px",
        "tight-section": "-1.2px",
        "tight-sub": "-0.9px",
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
          interactive: "var(--color-hairline-interactive)",
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
          primary: "var(--color-on-primary)",
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
        sans: ["Camera Plain Variable", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        pill: "9999px",
      },
      boxShadow: {
        "lovable-btn": "rgba(255,255,255,0.2) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.2) 0px 0px 0px 0.5px inset, rgba(0,0,0,0.05) 0px 1px 2px 0px",
        "lovable-focus": "rgba(0,0,0,0.1) 0px 4px 12px",
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
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
