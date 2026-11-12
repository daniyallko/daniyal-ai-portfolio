import * as THREE from "three";
import { springStep } from "@/lib/particle-face";

const TOTAL_SAMPLES = 6000;

interface EngineOptions {
  count: number;
  onReady: () => void;
  onContextLoss: () => void;
}

const vertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform vec2 uGaze;
  attribute float aSeed;
  varying float vInfluence;
  varying float vDepth;

  void main() {
    vec3 displaced = position;
    float breath = sin(uTime * 0.55 + aSeed * 6.28318 + position.y * 2.0);
    displaced += normal * breath * 0.007;

    vec2 delta = displaced.xy - uPointer;
    float distanceSquared = dot(delta, delta);
    float influence = pow(max(0.0, 1.0 - distanceSquared / 0.1024), 2.0);
    displaced.xy += normalize(delta + vec2(0.0001)) * influence * 0.14;
    displaced.z += influence * 0.09;
    displaced.xy += uGaze * (0.035 + displaced.z * 0.012);

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (1.35 + aSeed * 0.85 + influence * 1.1) * uPixelRatio * (4.2 / -viewPosition.z);
    vInfluence = influence;
    vDepth = clamp((position.z + 0.65) / 1.3, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform float uDark;
  varying float vInfluence;
  varying float vDepth;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    if (radius > 0.5) discard;
    vec3 lightInk = vec3(0.12, 0.14, 0.12);
    vec3 darkInk = vec3(0.91, 0.90, 0.86);
    vec3 lightAccent = vec3(0.25, 0.39, 0.055);
    vec3 darkAccent = vec3(0.75, 0.87, 0.28);
    vec3 ink = mix(lightInk, darkInk, uDark);
    vec3 accent = mix(lightAccent, darkAccent, uDark);
    vec3 color = mix(ink, accent, vInfluence * 0.72);
    float edge = 1.0 - smoothstep(0.28, 0.5, radius);
    float alpha = edge * mix(0.38, 0.88, vDepth);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function mountParticleFace(
  host: HTMLElement,
  { count, onReady, onContextLoss }: EngineOptions,
): () => void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.z = 4.2;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, count <= 1500 ? 1.5 : 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.pointerEvents = "none";
  renderer.domElement.style.display = "block";
  host.append(renderer.domElement);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    seeds[index] = ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1;
  }
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const normalAttribute = new THREE.BufferAttribute(normals, 3);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("normal", normalAttribute);
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uPointer: { value: new THREE.Vector2(10, 10) },
    uGaze: { value: new THREE.Vector2(0, 0) },
    uDark: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let disposed = false;
  let ready = false;
  let announcedReady = false;
  let frameId = 0;
  let elapsed = 0;
  let previousTime = 0;
  let pointerX = 10;
  let pointerY = 10;
  let pointerVelocityX = 0;
  let pointerVelocityY = 0;
  let targetX = 10;
  let targetY = 10;
  const abort = new AbortController();

  const isDark = () => {
    const theme = document.documentElement.dataset["theme"];
    return theme
      ? theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const syncTheme = () => {
    const dark = isDark();
    uniforms.uDark.value = dark ? 1 : 0;
    material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  };
  syncTheme();
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  resizeObserver?.observe(host);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const onPointerMove = (event: PointerEvent) => {
    const bounds = host.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      targetX = 10;
      targetY = 10;
      return;
    }
    targetX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    targetY = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
  };
  const onPointerLeave = () => {
    targetX = 10;
    targetY = 10;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);

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
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 1 / 30) : 1 / 60;
    previousTime = time;
    elapsed += dt;
    [pointerX, pointerVelocityX] = springStep(
      pointerX,
      pointerVelocityX,
      targetX,
      dt,
    );
    [pointerY, pointerVelocityY] = springStep(
      pointerY,
      pointerVelocityY,
      targetY,
      dt,
    );
    uniforms.uTime.value = elapsed;
    uniforms.uPointer.value.set(pointerX, pointerY);
    uniforms.uGaze.value.set(
      THREE.MathUtils.clamp(pointerX, -1, 1),
      THREE.MathUtils.clamp(pointerY, -1, 1),
    );
    renderer.render(scene, camera);
    if (!announcedReady) {
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

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    pauseObserver.disconnect();
    resizeObserver?.disconnect();
    themeObserver.disconnect();
    document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", resize);
    renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
    scene.remove(points);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    dispose();
    onContextLoss();
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  void fetch("/models/generic-face.bin", { signal: abort.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Portrait asset returned ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      if (disposed) return;
      if (buffer.byteLength !== TOTAL_SAMPLES * 6 * 4) {
        throw new Error("Portrait asset has an invalid sample count");
      }
      const source = new Float32Array(buffer);
      for (let index = 0; index < count; index += 1) {
        const sourceSample = Math.floor((index * TOTAL_SAMPLES) / count);
        for (let axis = 0; axis < 3; axis += 1) {
          positions[index * 3 + axis] = source[sourceSample * 6 + axis] ?? 0;
          normals[index * 3 + axis] = source[sourceSample * 6 + axis + 3] ?? 0;
        }
      }
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
      geometry.computeBoundingSphere();
      ready = true;
      syncAnimation();
    })
    .catch((error: unknown) => {
      if (disposed || (error instanceof DOMException && error.name === "AbortError"))
        return;
      dispose();
      onContextLoss();
    });

  return dispose;
}
