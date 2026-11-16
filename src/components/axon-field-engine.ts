import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import {
  AXON_LIGHT_COLOR,
  AXON_SCENE,
  axonFrameScale,
  axonOrigin,
  axonRecoveryAlpha,
  axonSplatRadius,
} from "@/lib/axon-field";
import { createAxonFluid } from "./axon-fluid";
import { particleFragmentShader, particleVertexShader, positionShader } from "./axon-shaders";

interface EngineOptions {
  count: number;
  onReady: () => void;
  onContextLoss: () => void;
  simulationSize?: number;
  dyeSize?: number;
  pressureIterations?: number;
  pixelRatio?: number;
  frameRate?: number;
}

function createMatcap(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the AXON matcap");
  const image = context.createImageData(64, 64);
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const nx = (x / 63) * 2 - 1;
      const ny = (y / 63) * 2 - 1;
      const radiusSquared = nx * nx + ny * ny;
      const nz = Math.sqrt(Math.max(0, 1 - radiusSquared));
      const diffuse = Math.max(0, nx * -0.35 + ny * -0.5 + nz * 0.8);
      const highlight = Math.pow(Math.max(0, nz), 18) * 0.32;
      const value = Math.round(Math.min(1, 0.2 + diffuse * 0.65 + highlight) * 255);
      const index = (y * 64 + x) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function seededRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const AXON_CALM_MS = 4000;
const AXON_SLEEP_MS = 9000;

export function mountAxonField(
  host: HTMLElement,
  {
    count,
    onReady,
    onContextLoss,
    simulationSize,
    dyeSize,
    pressureIterations,
    pixelRatio = 1.25,
    frameRate = 60,
  }: EngineOptions,
): () => void {
  const size = Math.sqrt(count);
  if (!Number.isInteger(size)) throw new Error("AXON particle count must be a perfect square");

  const cleanup: Array<() => void> = [];
  let disposed = false;
  let frameId = 0;
  let shaderFailed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    for (const release of cleanup.splice(0).reverse()) release();
  };

  let syncAnimationRef: (() => void) | null = null;
  const total = size * size;
  const seedOrigins = new Float32Array(total * 4);
  const seedRandom = new Float32Array(total * 3);
  let cursor = 0;
  let sliceTimer: ReturnType<typeof setTimeout> | 0 = 0;
  cleanup.push(() => {
    if (sliceTimer) clearTimeout(sliceTimer);
  });
  // Generate particle seeds in ~8ms slices so startup never creates a long main-thread task.
  const slice = () => {
    sliceTimer = 0;
    if (disposed) return;
    const deadline = performance.now() + 8;
    while (cursor < total && performance.now() < deadline) {
      const end = Math.min(total, cursor + 2048);
      for (let index = cursor; index < end; index += 1) {
        const point = axonOrigin(
          seededRandom(index + 1) * Math.PI * 2,
          seededRandom(index + 17011) * Math.PI * 2,
        );
        const offset = index * 4;
        seedOrigins[offset] = point[0];
        seedOrigins[offset + 1] = point[1];
        seedOrigins[offset + 2] = point[2];
        seedOrigins[offset + 3] = seededRandom(index + 34019);
        seedRandom[index * 3] = seededRandom(index + 51001);
        seedRandom[index * 3 + 1] = seededRandom(index + 68003);
        seedRandom[index * 3 + 2] = seededRandom(index + 85007);
      }
      cursor = end;
    }
    if (cursor < total) {
      sliceTimer = setTimeout(slice, 0);
      return;
    }
    try {
      setup();
    } catch {
      dispose();
      onContextLoss();
    }
  };
  slice();
  return dispose;

  function setup() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(AXON_SCENE.fov, 1, AXON_SCENE.near, AXON_SCENE.far);
    camera.position.fromArray(AXON_SCENE.camera);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.display = "block";
    renderer.debug.onShaderError = () => {
      shaderFailed = true;
    };
    host.append(renderer.domElement);
    cleanup.push(() => {
      renderer.debug.onShaderError = null;
      renderer.dispose();
      renderer.domElement.remove();
    });

    const fluid = createAxonFluid(renderer, { simulationSize, dyeSize, pressureIterations });
    cleanup.push(() => fluid.dispose());
    const gpuCompute = new GPUComputationRenderer(size, size, renderer);
    cleanup.push(() => gpuCompute.dispose());
    const positionsTexture = gpuCompute.createTexture();
    const originsTexture = gpuCompute.createTexture();
    cleanup.push(() => {
      positionsTexture.dispose();
      originsTexture.dispose();
    });
    const origins = originsTexture.image.data as Float32Array;
    const positions = positionsTexture.image.data as Float32Array;

    origins.set(seedOrigins);
    positions.set(seedOrigins);

    const positionVariable = gpuCompute.addVariable(
      "texturePosition",
      positionShader,
      positionsTexture,
    );
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable]);
    const positionUniforms = {
      uOrigins: { value: originsTexture },
      uFluidVelocity: { value: fluid.velocity.read.texture as THREE.Texture },
      uFluidDensity: { value: fluid.density.read.texture as THREE.Texture },
      uViewProjection: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uDelta: { value: 1 / 60 },
      uRecovery: { value: axonRecoveryAlpha(1 / 60, false) },
    };
    Object.assign(positionVariable.material.uniforms, positionUniforms);
    const initializationError = gpuCompute.init();
    if (initializationError) throw new Error(initializationError);

    const geometry = new THREE.BufferGeometry();
    cleanup.push(() => geometry.dispose());
    const vertices = new Float32Array(size * size * 3);
    const references = new Float32Array(size * size * 2);
    const random = seedRandom;
    for (let index = 0; index < size * size; index += 1) {
      references[index * 2] = ((index % size) + 0.5) / size;
      references[index * 2 + 1] = (Math.floor(index / size) + 0.5) / size;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute("aReference", new THREE.BufferAttribute(references, 2));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(random, 3));

    const matcap = createMatcap();
    cleanup.push(() => matcap.dispose());
    const particleUniforms = {
      uPositions: {
        value: gpuCompute.getCurrentRenderTarget(positionVariable).texture as THREE.Texture,
      },
      uMatcap: { value: matcap },
      uLightColor: { value: new THREE.Color(AXON_LIGHT_COLOR) },
      uDarkColor: { value: new THREE.Color("#e4e3df") },
      uLavender: { value: new THREE.Color("#b8a8d8") },
      uDark: { value: 1 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uViewportHeight: { value: 900 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    cleanup.push(() => material.dispose());
    points.frustumCulled = false;
    const group = new THREE.Group();
    group.position.fromArray(AXON_SCENE.position);
    group.rotation.set(
      THREE.MathUtils.degToRad(AXON_SCENE.rotation[0]),
      THREE.MathUtils.degToRad(AXON_SCENE.rotation[1]),
      THREE.MathUtils.degToRad(AXON_SCENE.rotation[2]),
    );
    group.scale.fromArray(AXON_SCENE.scale);
    group.add(points);
    scene.add(group);
    cleanup.push(() => {
      scene.remove(group);
      group.remove(points);
    });

    const ready = true;
    let announcedReady = false;
    let previousTime = 0;
    let elapsed = 0;
    let lastInteraction = performance.now();
    let pointerActive = false;
    let pointerFrom = new THREE.Vector2();
    let pointerTo = new THREE.Vector2();
    let pointerDelta = new THREE.Vector2();
    const gaze = new THREE.Vector2();
    const gazeTarget = new THREE.Vector2();
    const baseCamera = new THREE.Vector3().fromArray(AXON_SCENE.camera);
    const viewProjection = new THREE.Matrix4();
    const frameInterval = 1000 / frameRate;

    const isDark = () => {
      const theme = document.documentElement.dataset["theme"];
      return theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    const syncTheme = () => {
      const dark = isDark();
      particleUniforms.uDark.value = dark ? 1 : 0;
      material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      lastInteraction = performance.now();
      if (!frameId && typeof syncAnimationRef === "function") syncAnimationRef();
    };
    syncTheme();
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    cleanup.push(() => themeObserver.disconnect());

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      const frameScale = axonFrameScale(width, height);
      camera.aspect = width / height;
      camera.zoom = 1 / frameScale;
      camera.updateProjectionMatrix();
      particleUniforms.uViewportHeight.value = height;
      fluid.resize(width, height);
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(host);
    window.addEventListener("resize", resize, { passive: true });
    cleanup.push(() => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
    });
    resize();

    const trackInteraction = (clientX: number, clientY: number) => {
      const bounds = host.getBoundingClientRect();
      if (
        clientX < bounds.left ||
        clientX > bounds.right ||
        clientY < bounds.top ||
        clientY > bounds.bottom
      ) {
        pointerActive = false;
        gazeTarget.set(0, 0);
        return;
      }
      const next = new THREE.Vector2(
        (clientX - bounds.left) / bounds.width,
        1 - (clientY - bounds.top) / bounds.height,
      );
      pointerFrom = pointerActive ? pointerTo.clone() : next.clone();
      pointerTo = next;
      pointerDelta = pointerTo.clone().sub(pointerFrom);
      pointerActive = true;
      lastInteraction = performance.now();
      if (!frameId) syncAnimation();
      gazeTarget.set(pointerTo.x * 2 - 1, pointerTo.y * 2 - 1);
    };
    const onPointerMove = (event: PointerEvent) => {
      trackInteraction(event.clientX, event.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      trackInteraction(touch.clientX, touch.clientY);
    };
    const onPointerLeave = () => {
      pointerActive = false;
      gazeTarget.set(0, 0);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerLeave, { passive: true });
    window.addEventListener("pointercancel", onPointerLeave, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onPointerLeave, { passive: true });
    window.addEventListener("touchcancel", onPointerLeave, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave, { passive: true });
    cleanup.push(() => {
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerLeave);
      window.removeEventListener("pointercancel", onPointerLeave);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onPointerLeave);
      window.removeEventListener("touchcancel", onPointerLeave);
    });

    syncAnimationRef = () => syncAnimation();
    const shouldAnimate = () =>
      !disposed &&
      ready &&
      host.parentElement?.dataset["paused"] !== "true" &&
      document.visibilityState === "visible";
    const syncAnimation = () => {
      if (!shouldAnimate()) {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        previousTime = 0;
        return;
      }
      if (!frameId) frameId = requestAnimationFrame(frame);
    };

    const frame = (time: number) => {
      frameId = 0;
      if (!shouldAnimate()) return;
      if (previousTime && time - previousTime < frameInterval - 1) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      const idleFor = time - lastInteraction;
      const settled = announcedReady && idleFor > AXON_SLEEP_MS && gaze.distanceTo(gazeTarget) < 0.002;
      if (settled) {
        // Quiescent sleep: fluid has dissipated and particles have recovered; wake on next pointer move.
        previousTime = 0;
        return;
      }
      const calm = announcedReady && idleFor > AXON_CALM_MS;
      if (calm && previousTime && time - previousTime < 1000 / 30 - 1) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      const dt = previousTime ? Math.min((time - previousTime) / 1000, 1 / 30) : 1 / 60;
      previousTime = time;
      elapsed += dt;

      if (pointerActive && pointerDelta.lengthSq() > 0) {
        fluid.splat(pointerFrom, pointerTo, pointerDelta, axonSplatRadius(count));
        pointerDelta.set(0, 0);
      }
      if (!calm) fluid.update(dt);
      positionUniforms.uFluidVelocity.value = fluid.velocity.read.texture;
      positionUniforms.uFluidDensity.value = fluid.density.read.texture;
      positionUniforms.uTime.value = elapsed;
      positionUniforms.uDelta.value = dt;
      positionUniforms.uRecovery.value = axonRecoveryAlpha(dt, time - lastInteraction < 120);

      gaze.lerp(gazeTarget, 0.05);
      camera.position.set(baseCamera.x + gaze.x * 0.08, baseCamera.y + gaze.y * 0.06, baseCamera.z);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      group.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      viewProjection.multiply(group.matrixWorld);
      positionUniforms.uViewProjection.value.copy(viewProjection);

      gpuCompute.compute();
      particleUniforms.uPositions.value =
        gpuCompute.getCurrentRenderTarget(positionVariable).texture;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (shaderFailed) {
        dispose();
        onContextLoss();
        return;
      }
      if (!announcedReady && !shaderFailed) {
        announcedReady = true;
        onReady();
      }
      frameId = requestAnimationFrame(frame);
    };

    const pauseObserver = new MutationObserver(syncAnimation);
    if (host.parentElement) {
      pauseObserver.observe(host.parentElement, {
        attributes: true,
        attributeFilter: ["data-paused"],
      });
    }
    document.addEventListener("visibilitychange", syncAnimation);
    cleanup.push(() => {
      pauseObserver.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
    });

    const onContextLost = (event: Event) => {
      event.preventDefault();
      dispose();
      onContextLoss();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    cleanup.push(() => renderer.domElement.removeEventListener("webglcontextlost", onContextLost));
    syncAnimation();
  }
}
