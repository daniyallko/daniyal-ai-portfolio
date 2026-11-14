export interface AxonBudgetInput {
  width: number;
  coarse: boolean;
  reducedMotion: boolean;
  reducedData: boolean;
}

export const AXON_DESKTOP_COUNT = 262144;
export const AXON_MOBILE_COUNT = 16384;
export const AXON_LIGHT_COLOR = "#506c00";

export const AXON_FLUID = {
  simulationSize: 256,
  dyeSize: 512,
  velocityDissipation: 0.98,
  densityDissipation: 0.97,
  pressureDissipation: 0.95,
  pressureIterations: 5,
  curl: 30,
  dt: 1 / 60,
} as const;

export const AXON_SCENE = {
  fov: 30,
  near: 0.1,
  far: 1000,
  camera: [-1.17, 0, 6],
  position: [0.343, 0.16, -1],
  rotation: [-28.4, 390, 4.92],
  scale: [5, 5, 6],
} as const;

export function axonBudget({ width, coarse, reducedMotion, reducedData }: AxonBudgetInput): number {
  if (reducedMotion || reducedData) return 0;
  return coarse || width < 768 ? AXON_MOBILE_COUNT : AXON_DESKTOP_COUNT;
}

export type AxonPoint = readonly [number, number, number];

export function axonOrigin(u: number, v: number): [number, number, number] {
  const twist = 0.35 * Math.sin(u * 2) + 0.3;
  const tube = 0.16 - 0.035 * Math.sin(u) + 0.012 * Math.sin(u * 3);
  const major = 0.47 + 0.035 * Math.sin(u * 3) + 0.015 * (Math.cos(u * 5) - 1);
  const depth = 0.65 * tube * Math.sin(v + twist);
  const mirroredDepth = Math.sqrt((depth / 0.65) ** 2 + 0.0215) - Math.sqrt(0.012);
  const surfaceRadius = Math.sqrt(Math.max(0, tube * tube - mirroredDepth * mirroredDepth));
  const radius = major + surfaceRadius * (Math.cos(v + twist) < 0 ? -1 : 1);
  return [0.6 * radius * Math.cos(u), 0.6 * 1.25 * radius * Math.sin(u), 0.6 * depth];
}

export function axonRingSdf(point: AxonPoint): number {
  const [px, py, pz] = point;
  const x = px / 0.6;
  const rawY = py / 0.6;
  const rawZ = pz / 0.6;
  const y = rawY / 1.25;
  let z = rawZ / 0.65;
  z = Math.sqrt(z * z + 0.0215) - Math.sqrt(0.012);
  const angle = Math.atan2(y, x);
  const twist = 0.35 * Math.sin(angle * 2) + 0.3;
  const tube = 0.16 - 0.035 * Math.sin(angle) + 0.012 * Math.sin(angle * 3);
  const major = 0.47 + 0.035 * Math.sin(angle * 3) + 0.015 * (Math.cos(angle * 5) - 1);
  const radial = Math.hypot(x, y) - major;
  const sectionX = Math.cos(twist) * radial - Math.sin(twist) * z;
  const sectionZ = Math.sin(twist) * radial + Math.cos(twist) * z;
  return (Math.hypot(sectionX, sectionZ) - tube) * 0.6;
}

export function axonFrameScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.max(1, 0.6 / (width / height));
}

export function axonSplatRadius(_count: number): number {
  return 0.002;
}

export function axonProject(point: AxonPoint, width: number, height: number): [number, number] {
  type Vector3 = [number, number, number];
  const [sx, sy, sz] = AXON_SCENE.scale;
  const [rx, ry, rz] = AXON_SCENE.rotation.map((angle) => (angle * Math.PI) / 180) as Vector3;
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  const x = point[0] * sx;
  const y = point[1] * sy;
  const z = point[2] * sz;
  const world: Vector3 = [
    c * e * x - c * f * y + d * z + AXON_SCENE.position[0],
    (a * f + b * e * d) * x + (a * e - b * f * d) * y - b * c * z + AXON_SCENE.position[1],
    (b * f - a * e * d) * x + (b * e + a * f * d) * y + a * c * z + AXON_SCENE.position[2],
  ];
  const eye: AxonPoint = AXON_SCENE.camera;
  const backwardLength = Math.hypot(...eye);
  const backward = eye.map((value) => value / backwardLength) as Vector3;
  const right: Vector3 = [backward[2], 0, -backward[0]];
  const rightLength = Math.hypot(...right);
  right[0] /= rightLength;
  right[2] /= rightLength;
  const up: Vector3 = [
    backward[1] * right[2] - backward[2] * right[1],
    backward[2] * right[0] - backward[0] * right[2],
    backward[0] * right[1] - backward[1] * right[0],
  ];
  const relative = world.map((value, index) => value - eye[index]!) as Vector3;
  const dot = (a: AxonPoint, b: AxonPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const viewX = dot(relative, right);
  const viewY = dot(relative, up);
  const depth = -dot(relative, backward);
  const zoom = 1 / axonFrameScale(width, height);
  const halfFov = Math.tan((AXON_SCENE.fov * Math.PI) / 360);
  const ndcX = (viewX / depth / (halfFov * (width / height))) * zoom;
  const ndcY = (viewY / depth / halfFov) * zoom;
  return [(ndcX * 0.5 + 0.5) * width, (-ndcY * 0.5 + 0.5) * height];
}

export function axonQuality(count: number) {
  const mobile = count === AXON_MOBILE_COUNT;
  return {
    simulationSize: AXON_FLUID.simulationSize,
    dyeSize: AXON_FLUID.dyeSize,
    pressureIterations: AXON_FLUID.pressureIterations,
    pixelRatio: mobile ? 1 : 1.25,
    frameRate: 60,
  };
}

export function axonRecoveryAlpha(dt: number, interacting: boolean): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return 1 - Math.exp(-(interacting ? 1.5 : 5) * dt);
}
