import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { AXON_FLUID } from "@/lib/axon-field";
import {
  advectionShader,
  curlShader,
  divergenceShader,
  fluidVertexShader,
  gradientSubtractShader,
  pressureShader,
  splatShader,
  vorticityShader,
} from "./axon-shaders";

interface FluidOptions {
  simulationSize?: number | undefined;
  dyeSize?: number | undefined;
}

interface PingPong {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;
}

const target = (size: number): THREE.WebGLRenderTarget =>
  new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });

const pingPong = (size: number): PingPong => ({ read: target(size), write: target(size) });

export function createAxonFluid(
  renderer: THREE.WebGLRenderer,
  { simulationSize = AXON_FLUID.simulationSize, dyeSize = AXON_FLUID.dyeSize }: FluidOptions = {},
) {
  const velocity = pingPong(simulationSize);
  const density = pingPong(dyeSize);
  const pressure = pingPong(simulationSize);
  const curl = target(simulationSize);
  const divergence = target(simulationSize);
  const texel = new THREE.Vector2(1 / simulationSize, 1 / simulationSize);
  const dyeTexel = new THREE.Vector2(1 / dyeSize, 1 / dyeSize);
  const materials: THREE.ShaderMaterial[] = [];
  let disposed = false;

  const material = (
    fragmentShader: string,
    uniforms: Record<string, THREE.IUniform>,
  ): THREE.ShaderMaterial => {
    const result = new THREE.ShaderMaterial({
      vertexShader: fluidVertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    materials.push(result);
    return result;
  };

  const splatUniforms = {
    uPrevious: { value: null as THREE.Texture | null },
    uFrom: { value: new THREE.Vector2() },
    uTo: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Vector3() },
    uRadius: { value: 0.002 },
    uAspect: { value: 1 },
  };
  const curlUniforms = {
    uVelocity: { value: null as THREE.Texture | null },
    uTexel: { value: texel },
  };
  const vorticityUniforms = {
    uVelocity: { value: null as THREE.Texture | null },
    uCurl: { value: curl.texture },
    uTexel: { value: texel },
    uCurlStrength: { value: AXON_FLUID.curl },
    uDt: { value: AXON_FLUID.dt },
  };
  const divergenceUniforms = {
    uVelocity: { value: null as THREE.Texture | null },
    uTexel: { value: texel },
  };
  const pressureUniforms = {
    uPressure: { value: null as THREE.Texture | null },
    uDivergence: { value: divergence.texture },
    uTexel: { value: texel },
    uDissipation: { value: AXON_FLUID.pressureDissipation },
  };
  const gradientUniforms = {
    uPressure: { value: null as THREE.Texture | null },
    uVelocity: { value: null as THREE.Texture | null },
    uTexel: { value: texel },
  };
  const advectionUniforms = {
    uVelocity: { value: null as THREE.Texture | null },
    uSource: { value: null as THREE.Texture | null },
    uTexel: { value: texel },
    uDt: { value: AXON_FLUID.dt },
    uDissipation: { value: AXON_FLUID.velocityDissipation as number },
  };

  const splatMaterial = material(splatShader, splatUniforms);
  const curlMaterial = material(curlShader, curlUniforms);
  const vorticityMaterial = material(vorticityShader, vorticityUniforms);
  const divergenceMaterial = material(divergenceShader, divergenceUniforms);
  const pressureMaterial = material(pressureShader, pressureUniforms);
  const gradientMaterial = material(gradientSubtractShader, gradientUniforms);
  const advectionMaterial = material(advectionShader, advectionUniforms);
  const quad = new FullScreenQuad(splatMaterial);

  const render = (shader: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget) => {
    quad.material = shader;
    renderer.setRenderTarget(output);
    quad.render(renderer);
  };

  const swap = (field: PingPong) => {
    const previousRead = field.read;
    field.read = field.write;
    field.write = previousRead;
  };

  function splat(
    from: THREE.Vector2,
    to: THREE.Vector2,
    delta: THREE.Vector2,
    radius = 0.002,
  ) {
    if (disposed) return;
    splatUniforms.uFrom.value.copy(from);
    splatUniforms.uTo.value.copy(to);
    splatUniforms.uRadius.value = radius;

    splatUniforms.uPrevious.value = velocity.read.texture;
    splatUniforms.uColor.value.set(delta.x * 6000, delta.y * 6000, 0);
    render(splatMaterial, velocity.write);
    swap(velocity);

    splatUniforms.uPrevious.value = density.read.texture;
    const amount = Math.min(delta.length() * 180, 1.5);
    splatUniforms.uColor.value.setScalar(amount);
    render(splatMaterial, density.write);
    swap(density);
  }

  const advect = (
    field: PingPong,
    source: THREE.WebGLRenderTarget,
    sourceTexel: THREE.Vector2,
    dt: number,
    dissipation: number,
  ) => {
    advectionUniforms.uVelocity.value = velocity.read.texture;
    advectionUniforms.uSource.value = source.texture;
    advectionUniforms.uTexel.value = sourceTexel;
    advectionUniforms.uDt.value = dt;
    advectionUniforms.uDissipation.value = dissipation;
    render(advectionMaterial, field.write);
    swap(field);
  };

  function update(dt: number) {
    if (disposed) return;
    const step = Math.min(dt, AXON_FLUID.dt);
    curlUniforms.uVelocity.value = velocity.read.texture;
    render(curlMaterial, curl);

    vorticityUniforms.uVelocity.value = velocity.read.texture;
    vorticityUniforms.uDt.value = step;
    render(vorticityMaterial, velocity.write);
    swap(velocity);

    divergenceUniforms.uVelocity.value = velocity.read.texture;
    render(divergenceMaterial, divergence);

    for (let iteration = 0; iteration < AXON_FLUID.pressureIterations; iteration += 1) {
      pressureUniforms.uPressure.value = pressure.read.texture;
      render(pressureMaterial, pressure.write);
      swap(pressure);
    }

    gradientUniforms.uPressure.value = pressure.read.texture;
    gradientUniforms.uVelocity.value = velocity.read.texture;
    render(gradientMaterial, velocity.write);
    swap(velocity);

    advect(velocity, velocity.read, texel, step, AXON_FLUID.velocityDissipation);
    advect(density, density.read, dyeTexel, step, AXON_FLUID.densityDissipation);
    renderer.setRenderTarget(null);
  }

  function resize(): void;
  function resize(width: number, height: number): void;
  function resize(width = 1, height = 1) {
    splatUniforms.uAspect.value = width / Math.max(height, 1);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const field of [velocity, density, pressure]) {
      field.read.dispose();
      field.write.dispose();
    }
    curl.dispose();
    divergence.dispose();
    for (const shader of materials) shader.dispose();
    quad.dispose();
  }

  return { update, splat, velocity, density, resize, dispose };
}

export type AxonFluid = ReturnType<typeof createAxonFluid>;
