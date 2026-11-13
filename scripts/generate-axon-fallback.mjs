import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axonOrigin, axonProject } from "../src/lib/axon-field.ts";

const COUNT = 1400;
const TAU = Math.PI * 2;
let seed = 0x41584f4e;

function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const samples = Array.from({ length: COUNT }, () => {
  const point = axonOrigin(random() * TAU, random() * TAU);
  return {
    point,
    opacity: (0.3 + (point[2] + 0.65) * 0.55).toFixed(3),
    radius: (1.1 + random() * 1.5).toFixed(3),
  };
});

function render(width, height) {
  const circles = samples
    .map(({ point, opacity, radius }) => {
      const [x, y] = axonProject(point, width, height);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" opacity="${opacity}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">Generic AXON ring</title><g fill="white">${circles}</g></svg>\n`;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await Promise.all([
  writeFile(resolve(root, "public/images/axon-ring.svg"), render(1440, 900)),
  writeFile(resolve(root, "public/images/axon-ring-narrow.svg"), render(390, 844)),
]);
console.log(`Generated ${COUNT} AXON fallback points for wide and narrow frames`);
