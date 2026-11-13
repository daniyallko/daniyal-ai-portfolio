import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const circles = Array.from({ length: COUNT }, (_, index) => {
  const u = random() * TAU;
  const v = random() * TAU;
  const twist = 0.35 * Math.sin(u * 2) + 0.3;
  const tube = 0.16 - 0.035 * Math.sin(u) + 0.012 * Math.sin(u * 3);
  const major = 0.47 + 0.035 * Math.sin(u * 3) + 0.015 * (Math.cos(u * 5) - 1);
  const depth = 0.65 * tube * Math.sin(v + twist);
  const mirroredDepth = Math.sqrt((depth / 0.65) ** 2 + 0.0215) - Math.sqrt(0.012);
  const surfaceRadius = Math.sqrt(Math.max(0, tube * tube - mirroredDepth * mirroredDepth));
  const radius = major + surfaceRadius * (Math.cos(v + twist) < 0 ? -1 : 1);
  const [x, y, z] = [0.6 * radius * Math.cos(u), 0.6 * 1.25 * radius * Math.sin(u), 0.6 * depth];
  const opacity = (0.3 + (z + 0.65) * 0.55).toFixed(3);
  const pointRadius = (0.65 + random() * 1.1).toFixed(3);
  return `<circle cx="${(300 + x * 280).toFixed(2)}" cy="${(300 - y * 280).toFixed(2)}" r="${pointRadius}" opacity="${opacity}" data-sample="${index}"/>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-labelledby="title"><title id="title">Generic AXON ring</title><g fill="white">${circles}</g></svg>\n`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(resolve(root, "public/images/axon-ring.svg"), svg);
console.log(`Generated ${COUNT} AXON fallback points`);
