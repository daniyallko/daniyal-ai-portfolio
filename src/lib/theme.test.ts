import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_STORAGE_KEY, themeInitScript } from "./theme";

function runInit(stored: string | null, systemDark: boolean, denyStorage = false) {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  const storage = {
    getItem: (key: string) => {
      if (denyStorage) throw new Error("Storage denied");
      expect(key).toBe("daniyal.theme.v1");
      return stored;
    },
  };
  const windowMock = {
    localStorage: storage,
    matchMedia: (query: string) => {
      expect(query).toBe("(prefers-color-scheme: dark)");
      return { matches: systemDark };
    },
  };
  expect(() => new Function("window", "document", themeInitScript())(windowMock, document)).not.toThrow();
  return document.documentElement;
}

describe("theme resolution", () => {
  it("accepts saved light and dark values", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows system preference for invalid or absent values", () => {
    expect(resolveTheme("garbage", true)).toBe("dark");
    expect(resolveTheme("garbage", false)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("uses the versioned storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("daniyal.theme.v1");
  });
});

describe("pre-paint theme script", () => {
  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    [null, true, "dark"],
    [null, false, "light"],
  ] as const)("applies saved/system theme %s before React", (stored, systemDark, expected) => {
    const root = runInit(stored, systemDark);
    expect(root.dataset["theme"]).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
  });

  it("falls back safely when storage access is denied", () => {
    const root = runInit(null, true, true);
    expect(root.dataset["theme"]).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
