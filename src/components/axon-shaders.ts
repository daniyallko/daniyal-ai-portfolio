export const fluidVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const splatShader = /* glsl */ `
  uniform sampler2D uPrevious;
  uniform vec2 uFrom;
  uniform vec2 uTo;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uAspect;
  varying vec2 vUv;

  float segmentDistance(vec2 point, vec2 from, vec2 to) {
    vec2 pa = point - from;
    vec2 ba = to - from;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 point = vUv;
    vec2 from = uFrom;
    vec2 to = uTo;
    point.x *= uAspect;
    from.x *= uAspect;
    to.x *= uAspect;
    float distanceToStroke = segmentDistance(point, from, to);
    float influence = exp(-distanceToStroke * distanceToStroke / max(uRadius, 0.00001));
    vec3 previous = texture2D(uPrevious, vUv).rgb;
    gl_FragColor = vec4(previous + uColor * influence, 1.0);
  }
`;

export const curlShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
    float right = texture2D(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
    float value = 0.5 * (right - left - top + bottom);
    gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
  }
`;

export const vorticityShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexel;
  uniform float uCurlStrength;
  uniform float uDt;
  varying vec2 vUv;

  void main() {
    float left = abs(texture2D(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
    float right = abs(texture2D(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
    float bottom = abs(texture2D(uCurl, vUv - vec2(0.0, uTexel.y)).x);
    float top = abs(texture2D(uCurl, vUv + vec2(0.0, uTexel.y)).x);
    float center = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(top - bottom, right - left);
    force /= length(force) + 0.0001;
    force *= uCurlStrength * center;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
    gl_FragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
  }
`;

export const divergenceShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
    float right = texture2D(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
    vec2 center = texture2D(uVelocity, vUv).xy;
    if (vUv.x < uTexel.x) left = -center.x;
    if (vUv.x > 1.0 - uTexel.x) right = -center.x;
    if (vUv.y < uTexel.y) bottom = -center.y;
    if (vUv.y > 1.0 - uTexel.y) top = -center.y;
    gl_FragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
  }
`;

export const pressureShader = /* glsl */ `
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexel;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (left + right + bottom + top - divergence) * 0.25;
    gl_FragColor = vec4(pressure * uDissipation, 0.0, 0.0, 1.0);
  }
`;

export const gradientSubtractShader = /* glsl */ `
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(right - left, top - bottom);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const advectionShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  uniform float uDt;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 previousUv = vUv - uDt * velocity * uTexel;
    vec4 result = texture2D(uSource, previousUv);
    gl_FragColor = result * uDissipation;
  }
`;

export const positionShader = /* glsl */ `
  uniform sampler2D uOrigins;
  uniform sampler2D uFluidVelocity;
  uniform sampler2D uFluidDensity;
  uniform mat4 uViewProjection;
  uniform float uTime;
  uniform float uDelta;

  float ringSdf(vec3 point) {
    vec3 p = point / 0.6;
    p.y /= 1.25;
    p.z /= 0.65;
    p.z = sqrt(p.z * p.z + 0.0215) - sqrt(0.012);
    float angle = atan(p.y, p.x);
    float twist = 0.35 * sin(angle * 2.0) + 0.3;
    float tube = 0.16 - 0.035 * sin(angle) + 0.012 * sin(angle * 3.0);
    float major = 0.47 + 0.035 * sin(angle * 3.0) + 0.015 * (cos(angle * 5.0) - 1.0);
    vec2 section = vec2(length(p.xy) - major, p.z);
    float cosine = cos(twist);
    float sine = sin(twist);
    section = mat2(cosine, -sine, sine, cosine) * section;
    return (length(section) - tube) * 0.6;
  }

  vec3 sdfNormal(vec3 point) {
    const float epsilon = 0.0015;
    vec2 e = vec2(epsilon, 0.0);
    return normalize(vec3(
      ringSdf(point + e.xyy) - ringSdf(point - e.xyy),
      ringSdf(point + e.yxy) - ringSdf(point - e.yxy),
      ringSdf(point + e.yyx) - ringSdf(point - e.yyx)
    ));
  }

  vec3 curlNoise(vec3 p) {
    float t = uTime * 0.12;
    float potential3y = 1.2 * cos(p.y * 1.2 + t * 0.27);
    float potential2z = 1.9 * cos(p.z * 1.9 + t * 0.20);
    float potential1z = 1.3 * cos(p.z * 1.3 + t * 0.18);
    float potential3x = 2.0 * cos(p.x * 2.0 - t * 0.18);
    float potential2x = 1.1 * cos(p.x * 1.1 - t * 0.16);
    float potential1y = 2.1 * cos(p.y * 2.1 - t * 0.24);
    return vec3(
      potential3y - potential2z,
      potential1z - potential3x,
      potential2x - potential1y
    );
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 data = texture2D(texturePosition, uv);
    vec3 pos = data.xyz;
    vec3 origin = texture2D(uOrigins, uv).xyz;
    float hz = min(uDelta * 60.0, 2.0);
    if (length(pos) > 0.7) pos /= 2.0;

    float sdf = ringSdf(pos);
    vec3 gradient = sdfNormal(pos);
    pos += curlNoise(pos * 0.1 + vec3(uTime * 0.05)) * 0.0002 * hz;
    pos += cross(normalize(pos), normalize(gradient)) * 0.0005;
    pos += -gradient * sdf * 0.5;
    pos += (origin - pos) * 0.0002 * hz;

    vec4 clip = uViewProjection * vec4(pos, 1.0);
    vec2 fluidUv = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
    float inside = step(0.0, fluidUv.x) * step(fluidUv.x, 1.0) * step(0.0, fluidUv.y) * step(fluidUv.y, 1.0);
    vec2 fluidVelocity = texture2D(uFluidVelocity, clamp(fluidUv, 0.0, 1.0)).xy;
    float fluidDensity = texture2D(uFluidDensity, clamp(fluidUv, 0.0, 1.0)).x;
    vec3 flow = vec3(fluidVelocity, 0.0);
    pos += flow * 0.0001 * hz * 0.4 * fluidDensity * inside;

    gl_FragColor = vec4(pos, data.w);
  }
`;

export const particleVertexShader = /* glsl */ `
  uniform sampler2D uPositions;
  uniform float uPixelRatio;
  uniform float uViewportHeight;
  attribute vec2 aReference;
  attribute vec3 aRandom;
  varying vec3 vNormal;
  varying vec3 random;
  varying float vDepth;

  void main() {
    vec3 particlePosition = texture2D(uPositions, aReference).xyz;
    vec4 viewPosition = modelViewMatrix * vec4(particlePosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (0.8 + pow(aRandom.x, 3.0) * 2.4) * uPixelRatio * (uViewportHeight / 900.0) * (7.0 / max(-viewPosition.z, 0.1));
    vNormal = normalize(normalMatrix * normalize(particlePosition));
    random = aRandom;
    vDepth = clamp((particlePosition.z + 0.65) / 1.3, 0.0, 1.0);
  }
`;

export const particleFragmentShader = /* glsl */ `
  uniform sampler2D uMatcap;
  uniform vec3 uLightColor;
  uniform vec3 uDarkColor;
  uniform vec3 uLavender;
  uniform float uDark;
  varying vec3 vNormal;
  varying vec3 random;
  varying float vDepth;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    if (radius > 0.5) discard;
    vec3 normal = normalize(vec3(point.x * 2.0, -point.y * 2.0, sqrt(max(0.0, 1.0 - radius * radius * 4.0))));
    vec3 matcap = texture2D(uMatcap, normal.xy * 0.5 + 0.5).rgb;
    vec3 base = mix(uLightColor, uDarkColor, uDark);
    float lavender = pow(random.y, 150.0) * uDark;
    vec3 color = mix(base, uLavender, lavender);
    float sparkle = pow(random.z, 100.0);
    color *= mix(0.55, 1.35, matcap.r);
    color += sparkle * 0.2;
    float edge = 1.0 - smoothstep(0.25, 0.5, radius);
    float alpha = edge * mix(0.34, 0.86, vDepth) * mix(0.72, 1.0, matcap.r);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;
