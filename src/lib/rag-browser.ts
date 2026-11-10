import { BoundedCache, CACHE_LIMIT, corpusVersion, type CacheEntry } from "@/lib/rag-cache";

const memory = new BoundedCache<CacheEntry>();
const STORAGE = "daniyal-public-rag-v1";
let hydrated = false;
let boot: Promise<void> | undefined;
export function hydrateBrowserCache() {
  if (hydrated) return;
  hydrated = true;
  try {
    const entries: CacheEntry[] = JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
    if (!Array.isArray(entries)) return;
    for (const entry of entries.slice(-CACHE_LIMIT)) {
      if (entry.version === corpusVersion() && entry.expiresAt > Date.now())
        memory.set(entry.key, entry, entry.expiresAt);
    }
  } catch {
    /* unavailable storage is not fatal */
  }
}
export function rememberBrowser(entries: CacheEntry[]) {
  hydrateBrowserCache();
  const valid = entries.filter((e) => e.version === corpusVersion() && e.expiresAt > Date.now());
  for (const entry of valid) memory.set(entry.key, entry, entry.expiresAt);
  try {
    const previous: CacheEntry[] = JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
    const merged = new Map(
      (Array.isArray(previous) ? previous : [])
        .filter((e) => e.version === corpusVersion() && e.expiresAt > Date.now())
        .map((e) => [e.key, e]),
    );
    for (const e of valid) merged.set(e.key, e);
    localStorage.setItem(STORAGE, JSON.stringify([...merged.values()].slice(-CACHE_LIMIT)));
  } catch {
    /* quota/private browsing fallback to RAM */
  }
}
export function browserCache(key: string) {
  hydrateBrowserCache();
  return memory.get(key);
}
export function warmBrowser(): Promise<void> {
  hydrateBrowserCache();
  if (boot) return boot;
  boot = fetch("/api/public/rag-warm", { method: "POST" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Cache warming unavailable");
      const data = (await response.json()) as { entries: CacheEntry[] };
      rememberBrowser(data.entries);
    })
    .catch(() => {
      boot = undefined;
    });
  return boot;
}
