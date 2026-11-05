const lifetimes = new WeakMap<Request, (task: Promise<unknown>) => void>();
const pending = new WeakMap<Request, Promise<void>[]>();
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
  const tasks = pending.get(request) ?? [];
  tasks.push(safe); pending.set(request, tasks);
  return Promise.resolve();
}
export async function drainDeferred(request: Request) {
  await Promise.all(pending.get(request) ?? []);
  pending.delete(request);
}