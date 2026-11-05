import { expect, it } from "vitest";
import { defer, drainDeferred, registerLifetime } from "./background.server";
it("flushes write-behind tasks without blocking active output", async () => {
  const request = new Request("http://localhost/cache");
  let resolve: (() => void) | undefined;
  let written = false;
  const task = new Promise<void>((done) => { resolve = done; }).then(() => { written = true; });
  await defer(request, task);
  expect(written).toBe(false);
  resolve?.();
  await drainDeferred(request);
  expect(written).toBe(true);
});
it("uses worker request lifetime when provided", async () => {
  const tasks: Promise<unknown>[] = [];
  const request = new Request("http://localhost/cache");
  registerLifetime(request, { waitUntil: (task: Promise<unknown>) => tasks.push(task) });
  await defer(request, Promise.resolve());
  expect(tasks).toHaveLength(1);
  await Promise.all(tasks);
});