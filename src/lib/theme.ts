export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "daniyal.theme.v1";

export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

export function themeInitScript(): string {
  return `(function(){var dark=false;try{dark=window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}var theme=dark?"dark":"light";try{var stored=window.localStorage.getItem("${THEME_STORAGE_KEY}");if(stored==="light"||stored==="dark")theme=stored;}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();`;
}
