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

export function axonSplatRadius(count: number): number {
  return count === AXON_MOBILE_COUNT ? 0.0016 : 0.002;
}
