const lifetimes = new WeakMap<Request, (task: Promise<unknown>) => void>();
export function registerLifetime(request: Request, context: unknown) {
  if (context && typeof context === "object" && "waitUntil" in context && typeof context.waitUntil === "function") {
    const waitUntil = context.waitUntil.bind(context);
    lifetimes.set(request, (task) => waitUntil(task));
  }
}
/** Returns a fallback promise to await at the end of the response stream. */
export function defer(request: Request, task: Promise<unknown>): Promise<void> {
  const safe = task.then(() => {}, (error: unknown) => console.error("RAG background task failed", error));
  const lifetime = lifetimes.get(request);
  if (lifetime) { lifetime(safe); return Promise.resolve(); }
  if ("waitUntil" in request && typeof request.waitUntil === "function") {
    request.waitUntil(safe); return Promise.resolve();
  }
  return safe;
}