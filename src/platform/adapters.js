const STORAGE_PREFIX = "ismsp-study:";

export function createBrowserPlatform() {
  return {
    storage: {
      get(key, fallback = null) {
        try {
          const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
          return raw === null ? fallback : JSON.parse(raw);
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        try {
          window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
        } catch {
          // Local storage may be unavailable in private or embedded contexts.
        }
      },
    },
    haptics: {
      impact() {
        if ("vibrate" in navigator) navigator.vibrate(10);
      },
    },
    locale: {
      defaultLocale() {
        return "ko";
      },
    },
  };
}
