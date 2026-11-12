export interface ParticleBudgetInput {
  width: number;
  coarse: boolean;
  reducedMotion: boolean;
  reducedData: boolean;
}

export function particleBudget({
  width,
  coarse,
  reducedMotion,
  reducedData,
}: ParticleBudgetInput): number {
  if (reducedMotion || reducedData) return 0;
  return coarse || width < 768 ? 1500 : 3000;
}

export function springStep(
  value: number,
  velocity: number,
  target: number,
  dt: number,
): [number, number] {
  if (dt <= 0) return [value, velocity];
  const step = Math.min(dt, 1 / 30);
  const acceleration = 42 * (target - value) - 13 * velocity;
  const nextVelocity = velocity + acceleration * step;
  return [value + nextVelocity * step, nextVelocity];
}

export function pointerInfluence(
  dx: number,
  dy: number,
  radius = 0.32,
): number {
  const distance = Math.hypot(dx, dy) / radius;
  if (distance >= 1) return 0;
  const falloff = 1 - distance * distance;
  return falloff * falloff;
}
