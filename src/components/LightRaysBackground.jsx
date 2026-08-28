import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const DEFAULT_COLOR = '#ffffff';

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [
        parseInt(match[1], 16) / 255,
        parseInt(match[2], 16) / 255,
        parseInt(match[3], 16) / 255,
      ]
    : [1, 1, 1];
}

function getAnchorAndDir(origin, width, height) {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * height], dir: [0, 1] };
    case 'top-right':
      return { anchor: [width, -outside * height], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * width, 0.5 * height], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * width, 0.5 * height], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * height], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * width, (1 + outside) * height], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [width, (1 + outside) * height], dir: [0, -1] };
    default:
      return { anchor: [0.5 * width, -outside * height], dir: [0, 1] };
  }
}

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec4 rays1 = vec4(1.0) * rayStrength(rayPos, rayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) * rayStrength(rayPos, rayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

export default function LightRaysBackground({
  backgroundColor = '#b6c7d2',
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 0.55,
  lightSpread = 1.1,
  rayLength = 2.1,
  pulsating = false,
  fadeDistance = 1.15,
  saturation = 0.78,
  noiseAmount = 0.015,
  distortion = 0.035,
}) {
  const containerRef = useRef(null);
  const rafRef = useRef(0);
  const rendererRef = useRef(null);
  const uniformsRef = useRef(null);
  const meshRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 1.6),
      alpha: true,
    });
    rendererRef.current = renderer;

    const gl = renderer.gl;
    gl.canvas.className = 'light-rays-background-canvas';
    gl.canvas.style.display = 'block';
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.pointerEvents = 'none';

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(gl.canvas);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(raysColor) },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1.0 : 0.0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
    };
    uniformsRef.current = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms });
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const updatePlacement = () => {
      const widthCss = Math.max(1, container.clientWidth);
      const heightCss = Math.max(1, container.clientHeight);
      renderer.dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      renderer.setSize(widthCss, heightCss);
      const width = widthCss * renderer.dpr;
      const height = heightCss * renderer.dpr;
      uniforms.iResolution.value = [width, height];
      const { anchor, dir } = getAnchorAndDir(raysOrigin, width, height);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
    };

    const render = (time) => {
      uniforms.iTime.value = time * 0.001;
      renderer.render({ scene: mesh });
      rafRef.current = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(updatePlacement);
    resizeObserver.observe(container);
    window.addEventListener('resize', updatePlacement);
    updatePlacement();
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePlacement);
      try {
        const loseContext = gl.getExtension('WEBGL_lose_context');
        loseContext?.loseContext();
      } catch {
        // Ignore WebGL cleanup differences across browsers.
      }
      if (gl.canvas.parentNode) {
        gl.canvas.parentNode.removeChild(gl.canvas);
      }
      rendererRef.current = null;
      uniformsRef.current = null;
      meshRef.current = null;
    };
  }, [
    raysOrigin,
    raysColor,
    raysSpeed,
    lightSpread,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    noiseAmount,
    distortion,
  ]);

  return (
    <div
      ref={containerRef}
      className="light-rays-background"
      aria-hidden="true"
      style={{ backgroundColor }}
    />
  );
}
