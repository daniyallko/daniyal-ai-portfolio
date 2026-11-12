import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_COUNT = 6000;
const EYE_SAMPLES = 480;
const HEAD_CROP_Y = 5.72;
const SEED = 0x4d484d30;
const SOURCE_URL =
  "https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: node scripts/generate-face-assets.mjs /path/to/base.obj");
}

const source = await readFile(resolve(sourcePath), "utf8");
const vertices = [];
const groups = new Map();
let group = "default";

for (const line of source.split(/\r?\n/)) {
  if (line.startsWith("v ")) {
    const [, x, y, z] = line.trim().split(/\s+/);
    vertices.push([Number(x), Number(y), Number(z)]);
  } else if (line.startsWith("g ")) {
    group = line.slice(2).trim();
    if (!groups.has(group)) groups.set(group, []);
  } else if (line.startsWith("f ")) {
    const indices = line
      .slice(2)
      .trim()
      .split(/\s+/)
      .map((token) => Number(token.split("/")[0]) - 1);
    groups.get(group)?.push(indices);
  }
}

function trianglesFor(groupNames, crop = false) {
  const triangles = [];
  for (const name of groupNames) {
    for (const polygon of groups.get(name) ?? []) {
      for (let index = 1; index < polygon.length - 1; index += 1) {
        const triangle = [polygon[0], polygon[index], polygon[index + 1]].map(
          (vertexIndex) => vertices[vertexIndex],
        );
        if (crop && triangle.some((vertex) => vertex[1] < HEAD_CROP_Y)) continue;
        triangles.push(triangle);
      }
    }
  }
  return triangles;
}

const bodyTriangles = trianglesFor(["body"], true);
const eyeTriangles = trianglesFor(["helper-l-eye", "helper-r-eye"]);
if (bodyTriangles.length === 0 || eyeTriangles.length === 0) {
  throw new Error("Expected MakeHuman body and helper eye geometry");
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function prepare(triangles) {
  let totalArea = 0;
  const cumulative = triangles.map((triangle) => {
    const normal = cross(
      subtract(triangle[1], triangle[0]),
      subtract(triangle[2], triangle[0]),
    );
    const area = Math.hypot(...normal) / 2;
    totalArea += area;
    return { triangle, normal: normalize(normal), end: totalArea };
  });
  return { cumulative, totalArea };
}

const body = prepare(bodyTriangles);
const eyes = prepare(eyeTriangles);

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = randomGenerator(SEED);

function sample(prepared) {
  const areaTarget = random() * prepared.totalArea;
  let low = 0;
  let high = prepared.cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (areaTarget <= prepared.cumulative[middle].end) high = middle;
    else low = middle + 1;
  }
  const { triangle, normal } = prepared.cumulative[low];
  const root = Math.sqrt(random());
  const second = random();
  const weights = [1 - root, root * (1 - second), root * second];
  const point = [0, 1, 2].map((axis) =>
    triangle.reduce(
      (sum, vertex, index) => sum + vertex[axis] * weights[index],
      0,
    ),
  );
  return { point, normal };
}

const samples = [
  ...Array.from({ length: SAMPLE_COUNT - EYE_SAMPLES }, () => sample(body)),
  ...Array.from({ length: EYE_SAMPLES }, () => sample(eyes)),
];
const bounds = [0, 1, 2].map((axis) => {
  const values = samples.map(({ point }) => point[axis]);
  return [Math.min(...values), Math.max(...values)];
});
const center = bounds.map(([minimum, maximum]) => (minimum + maximum) / 2);
const scale = 1.9 / Math.max(...bounds.map(([minimum, maximum]) => maximum - minimum));
const normalized = samples.map(({ point, normal }) => ({
  point: point.map((component, axis) => (component - center[axis]) * scale),
  normal,
}));

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(resolve(root, "public/models"), { recursive: true });
await mkdir(resolve(root, "public/images"), { recursive: true });

const bytes = Buffer.alloc(SAMPLE_COUNT * 6 * 4);
normalized.forEach(({ point, normal }, index) => {
  [...point, ...normal].forEach((value, component) => {
    bytes.writeFloatLE(value, index * 24 + component * 4);
  });
});
await writeFile(resolve(root, "public/models/generic-face.bin"), bytes);

const circles = normalized
  .map(({ point }, index) => {
    const depth = Math.max(0, Math.min(1, (point[2] + 0.5) / 1.4));
    const opacity = (0.25 + depth * 0.65).toFixed(3);
    const radius = (0.42 + depth * 0.5).toFixed(3);
    return `<circle cx="${(point[0] * 100).toFixed(2)}" cy="${(-point[1] * 100).toFixed(2)}" r="${radius}" opacity="${opacity}" data-sample="${index}"/>`;
  })
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -120 240 240" role="img" aria-labelledby="title"><title id="title">Generic computational portrait</title><g fill="#171920">${circles}</g></svg>\n`;
await writeFile(resolve(root, "public/images/generic-face.svg"), svg);

const notice = `Generic computational portrait source
=====================================

This is generated from the generic MakeHuman hm08 base mesh. It is not a
likeness of Mohd Daniyal or any other individual.

Source: ${SOURCE_URL}
Source project: MakeHuman Community
Asset license: CC0 1.0 Universal
License: https://creativecommons.org/publicdomain/zero/1.0/
License statement: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md

MakeHuman states: "The base mesh and proxies" and other bundled graphical
assets "have been released under CC0 1.0 Universal." The source base.obj
header also explicitly records its CC0 release in September 2020.

Generated assets use only head-cropped body and helper-eye geometry, sampled
with a fixed seed. No source OBJ is vendored in this project.
`;
await writeFile(resolve(root, "public/models/generic-face.LICENSE.txt"), notice);
console.log(`Generated ${SAMPLE_COUNT} points from ${bodyTriangles.length} head and ${eyeTriangles.length} eye triangles`);
