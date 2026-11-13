import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const shaders = read("src/components/axon-shaders.ts");
const fluid = read("src/components/axon-fluid.ts");
const engine = read("src/components/axon-field-engine.ts");

describe("AXON GPU shader contracts", () => {
  it("builds the mirrored twisted ring and restores particles to its surface", () => {
    expect(shaders).toContain("vec3 p = point / 0.6;");
    expect(shaders).toContain("float tube = 0.16 - 0.035 * sin(angle) + 0.012 * sin(angle * 3.0);");
    expect(shaders).toContain(
      "float major = 0.47 + 0.035 * sin(angle * 3.0) + 0.015 * (cos(angle * 5.0) - 1.0);",
    );
    expect(shaders).toContain("return (length(section) - tube) * 0.6;");
    expect(shaders).toContain("length(p.xy) - major");
    expect(shaders).toContain("p.y /= 1.25;");
    expect(shaders).toContain("p.z /= 0.65;");
    expect(shaders).toContain("p.z = sqrt(p.z * p.z + 0.0215) - sqrt(0.012)");
    expect(shaders).toContain("vec3 sdfNormal");
    expect(shaders).toContain("cross(normalize(pos), normalize(gradient)) * 0.0005");
    expect(shaders).toContain("pos += -gradient * sdf * 0.5");
    expect(shaders).toContain("(origin - pos) * 0.0002 * hz");
  });

  it("uses the reference timestep without compounding 60Hz twice", () => {
    expect(shaders).toContain("float hz = min(uDelta * 60.0, 2.0);");
    expect(shaders).toContain("curlNoise(pos * 0.1 + vec3(uTime * 0.05)) * 0.0002 * hz");
    expect(shaders).toContain("(origin - pos) * 0.0002 * hz");
    expect(shaders).toContain("flow * 0.0001 * hz * 0.4 * fluidDensity");
    expect(shaders).not.toContain("#define HZ 60.0");
  });

  it("uses analytic curl derivatives and projected fluid feedback", () => {
    expect(shaders).toContain("vec3 curlNoise");
    for (const derivative of [
      "potential3y",
      "potential2z",
      "potential1z",
      "potential3x",
      "potential2x",
      "potential1y",
    ]) {
      expect(shaders).toContain(derivative);
    }
    expect(shaders).toContain("uViewProjection");
    expect(shaders).toContain("texture2D(uFluidVelocity");
    expect(shaders).toContain("texture2D(uFluidDensity");
  });

  it("defines every fluid pass and the particle matcap treatment", () => {
    for (const name of [
      "splatShader",
      "curlShader",
      "vorticityShader",
      "divergenceShader",
      "pressureShader",
      "gradientSubtractShader",
      "advectionShader",
      "particleVertexShader",
      "particleFragmentShader",
    ]) {
      expect(shaders).toContain(`export const ${name}`);
    }
    expect(shaders).toContain("uMatcap");
    expect(shaders).toContain("pow(random.y, 150.0)");
    expect(shaders).toContain("pow(random.z, 100.0)");
    expect(shaders).not.toContain("pow(random.z, 100)");
    expect(shaders).toContain("#include <colorspace_fragment>");
  });
});

describe("AXON fluid lifecycle", () => {
  it("uses half-float ping-pong targets and the approved pressure loop", () => {
    expect(fluid).toContain("HalfFloatType");
    expect(fluid).toContain("AXON_FLUID.pressureIterations");
    expect(fluid).toContain("velocity");
    expect(fluid).toContain("density");
  });

  it("exposes updates, segment splats, resizing, and disposal", () => {
    expect(fluid).toMatch(/update\(dt:\s*number\)/);
    expect(fluid).toMatch(/splat\(/);
    expect(fluid).toContain("uPrevious");
    expect(fluid).toContain("resize()");
    expect(fluid).toContain("dispose()");
  });
});

describe("AXON renderer lifecycle", () => {
  it("derives a square position texture from the approved particle count", () => {
    expect(engine).toContain("const size = Math.sqrt(count)");
    expect(engine).toContain("new GPUComputationRenderer(size, size, renderer)");
    expect(engine).toContain("size * size");
  });

  it("uses the local matcap, reference scene, and exact light color", () => {
    expect(engine).toContain("createMatcap");
    expect(engine).toContain("64");
    expect(engine).toContain("AXON_SCENE");
    expect(engine).toContain("new THREE.Color(AXON_LIGHT_COLOR)");
    expect(engine).toContain("THREE.AdditiveBlending");
    expect(engine).toContain("THREE.NormalBlending");
  });

  it("listens passively and pauses from the wrapper without React state", () => {
    expect(engine).toContain(
      'window.addEventListener("pointermove", onPointerMove, { passive: true })',
    );
    expect(engine).toContain('attributeFilter: ["data-paused"]');
    expect(engine).toContain('document.visibilityState === "visible"');
    expect(engine).not.toContain("preventDefault();\n\n  const onPointerMove");
  });

  it("keeps the fallback on shader failure and cleans partial mounts", () => {
    expect(engine).toContain("renderer.debug.onShaderError");
    expect(engine).toMatch(
      /if \(shaderFailed\)[\s\S]*?dispose\(\);[\s\S]*?onContextLoss\(\);[\s\S]*?return;/,
    );
    expect(engine).toMatch(/if \(!announcedReady && !shaderFailed\)/);
    expect(engine).toMatch(/catch \(error\) \{\s*dispose\(\);\s*throw error;/);
  });

  it("announces readiness only after rendering and disposes every GPU owner", () => {
    expect(engine).toMatch(/renderer\.render\(scene, camera\);[\s\S]*onReady\(\)/);
    for (const cleanup of [
      "gpuCompute.dispose()",
      "fluid.dispose()",
      "geometry.dispose()",
      "material.dispose()",
      "matcap.dispose()",
      "renderer.dispose()",
      "cancelAnimationFrame",
      "removeEventListener",
    ]) {
      expect(engine).toContain(cleanup);
    }
  });
});
