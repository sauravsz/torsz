export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "torsz_theme_mode";

export function getThemePreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode;
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {}
  return "light"; // Light mode is default
}

export function applyTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    const isDark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {
    console.warn("Failed to apply theme:", e);
  }
}

export function initThemeListener(onChange: (mode: ThemeMode) => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    const current = getThemePreference();
    if (current === "system") {
      applyTheme("system");
      onChange("system");
    }
  };

  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
