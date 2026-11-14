/* Vengeance UI — interactive-particles (MIT, © Ashutoshx7; based on Bruno Imbrizi's
   Codrops "Interactive Particles"). Ported from the registry TSX.
   Aegis adaptations: JSX, no upload control (the image is passed in), transparent
   background, touch support, and `makeShieldImage()` which draws the Aegis shield
   in a canvas so no external image is needed. */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const SIMPLEX_2D = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const VERT = `
precision highp float;
attribute float pindex;
attribute vec3 position;
attribute vec3 offset;
attribute vec2 uv;
attribute float angle;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uRandom;
uniform float uDepth;
uniform float uSize;
uniform vec2 uTextureSize;
uniform sampler2D uTexture;
uniform sampler2D uTouch;
varying vec2 vPUv;
varying vec2 vUv;
${SIMPLEX_2D}
float random(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  vUv = uv;
  vec2 puv = offset.xy / uTextureSize;
  vPUv = puv;
  vec4 colA = texture2D(uTexture, puv);
  float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
  vec3 displaced = offset;
  displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * uRandom;
  float rndz = (random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1)));
  displaced.z += rndz * (random(pindex) * 2.0 * uDepth);
  displaced.xy -= uTextureSize * 0.5;
  float t = texture2D(uTouch, puv).r;
  displaced.z += t * 20.0 * rndz;
  displaced.x += cos(angle) * t * 20.0 * rndz;
  displaced.y += sin(angle) * t * 20.0 * rndz;
  float psize = (snoise(vec2(uTime, pindex) * 0.5) + 2.0);
  psize *= max(grey, 0.2);
  psize *= uSize;
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  mvPosition.xyz += position * psize;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = `
precision highp float;
uniform sampler2D uTexture;
uniform vec3 uColor;
varying vec2 vPUv;
varying vec2 vUv;
void main() {
  vec4 colA = texture2D(uTexture, vPUv);
  float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
  float dist = 0.5 - distance(vUv, vec2(0.5));
  float t = smoothstep(0.0, 0.45, dist);
  vec3 rgb = vec3(grey) * uColor;
  float alpha = t * (0.35 + 0.65 * grey);
  gl_FragColor = vec4(rgb, alpha);
}
`;

class TouchTexture {
  constructor(radius) {
    this.size = 64;
    this.maxAge = 120;
    this.radius = radius;
    this.trail = [];
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.texture = new THREE.Texture(this.canvas);
  }
  easeOutSine(t, b, c, d) { return c * Math.sin((t / d) * (Math.PI / 2)) + b; }
  addTouch(x, y) {
    let force = 0;
    const last = this.trail[this.trail.length - 1];
    if (last) {
      const dx = last.x - x;
      const dy = last.y - y;
      force = Math.min((dx * dx + dy * dy) * 10000, 1);
    }
    this.trail.push({ x, y, age: 0, force });
  }
  update() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age++;
      if (this.trail[i].age > this.maxAge) this.trail.splice(i, 1);
    }
    for (const point of this.trail) this.drawTouch(point);
    this.texture.needsUpdate = true;
  }
  drawTouch(point) {
    const pos = { x: point.x * this.size, y: (1 - point.y) * this.size };
    let intensity = point.age < this.maxAge * 0.3
      ? this.easeOutSine(point.age / (this.maxAge * 0.3), 0, 1, 1)
      : this.easeOutSine(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7), 0, 1, 1);
    intensity *= point.force;
    const radius = this.size * this.radius * intensity;
    if (radius <= 0) return;
    const grd = this.ctx.createRadialGradient(pos.x, pos.y, radius * 0.25, pos.x, pos.y, radius);
    grd.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0.0)");
    this.ctx.beginPath();
    this.ctx.fillStyle = grd;
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

/** White shield with a check cut out, on black — bright pixels become particles. */
export function makeShieldImage(px = 240) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, px, px);
  ctx.save();
  ctx.scale(px / 24, px / 24);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D("M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"));
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D("m8.6 12.2 2.3 2.3 4.5-4.6"));
  ctx.restore();
  return c.toDataURL("image/png");
}

export function InteractiveParticles({
  src,
  maxDimension = 240,
  className,
  color = "#2563eb",
  size = 1.4,
  randomness = 1.6,
  depth = 3.0,
  touchRadius = 0.15,
  threshold = 34,
  label,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !src) return undefined;

    let disposed = false;
    const getSize = () => ({ width: container.clientWidth || 1, height: container.clientHeight || 1 });
    let view = getSize();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, view.width / view.height, 1, 10000);
    camera.position.z = 300;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(view.width, view.height);
    renderer.setClearColor(0x000000, 0);

    let fovHeight = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z;
    const clock = new THREE.Clock(true);
    const container3D = new THREE.Object3D();
    scene.add(container3D);

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    let object3D = null;
    let hitArea = null;
    let touch = null;
    let uniforms = null;
    let imgHeight = 0;

    const onPointerMove = (e) => {
      if (!hitArea || !touch) return;
      const rect = canvas.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNDC, camera);
      const hits = raycaster.intersectObject(hitArea);
      if (hits.length > 0 && hits[0].uv) touch.addTouch(hits[0].uv.x, hits[0].uv.y);
    };
    canvas.addEventListener("pointermove", onPointerMove);

    const applyScale = () => {
      if (!object3D || !hitArea || !imgHeight) return;
      const scale = (fovHeight / imgHeight) * 0.9;
      object3D.scale.set(scale, scale, 1);
      hitArea.scale.set(scale, scale, 1);
    };

    new THREE.TextureLoader().load(src, (texture) => {
      if (disposed) { texture.dispose(); return; }
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const image = texture.image;
      const longest = Math.max(image.width, image.height);
      const scaleDown = longest > maxDimension ? maxDimension / longest : 1;
      const imgWidth = Math.max(1, Math.round(image.width * scaleDown));
      imgHeight = Math.max(1, Math.round(image.height * scaleDown));
      const numPoints = imgWidth * imgHeight;

      const readCanvas = document.createElement("canvas");
      readCanvas.width = imgWidth;
      readCanvas.height = imgHeight;
      const rctx = readCanvas.getContext("2d");
      rctx.scale(1, -1);
      rctx.drawImage(image, 0, 0, imgWidth, imgHeight * -1);
      const colors = rctx.getImageData(0, 0, imgWidth, imgHeight).data;

      let numVisible = 0;
      for (let i = 0; i < numPoints; i++) if (colors[i * 4] > threshold) numVisible++;

      uniforms = {
        uTime: { value: 0 },
        uRandom: { value: 1.0 },
        uDepth: { value: 2.0 },
        uSize: { value: 0.0 },
        uTextureSize: { value: new THREE.Vector2(imgWidth, imgHeight) },
        uTexture: { value: texture },
        uTouch: { value: null },
        uColor: { value: new THREE.Color(color) },
      };
      const material = new THREE.RawShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, transparent: true });
      const geometry = new THREE.InstancedBufferGeometry();
      const positions = new THREE.BufferAttribute(new Float32Array(12), 3);
      positions.setXYZ(0, -0.5, 0.5, 0.0);
      positions.setXYZ(1, 0.5, 0.5, 0.0);
      positions.setXYZ(2, -0.5, -0.5, 0.0);
      positions.setXYZ(3, 0.5, -0.5, 0.0);
      geometry.setAttribute("position", positions);
      const uvs = new THREE.BufferAttribute(new Float32Array(8), 2);
      uvs.setXY(0, 0.0, 0.0);
      uvs.setXY(1, 1.0, 0.0);
      uvs.setXY(2, 0.0, 1.0);
      uvs.setXY(3, 1.0, 1.0);
      geometry.setAttribute("uv", uvs);
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 2, 1, 2, 3, 1]), 1));

      const indices = new Uint16Array(numVisible);
      const offsets = new Float32Array(numVisible * 3);
      const angles = new Float32Array(numVisible);
      for (let i = 0, j = 0; i < numPoints; i++) {
        if (colors[i * 4] <= threshold) continue;
        offsets[j * 3] = i % imgWidth;
        offsets[j * 3 + 1] = Math.floor(i / imgWidth);
        indices[j] = i;
        angles[j] = Math.random() * Math.PI;
        j++;
      }
      geometry.setAttribute("pindex", new THREE.InstancedBufferAttribute(indices, 1, false));
      geometry.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3, false));
      geometry.setAttribute("angle", new THREE.InstancedBufferAttribute(angles, 1, false));

      object3D = new THREE.Mesh(geometry, material);
      container3D.add(object3D);
      const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, depthTest: false });
      hitMat.visible = false;
      hitArea = new THREE.Mesh(new THREE.PlaneGeometry(imgWidth, imgHeight, 1, 1), hitMat);
      container3D.add(hitArea);
      touch = new TouchTexture(touchRadius);
      uniforms.uTouch.value = touch.texture;
      applyScale();

      gsap.fromTo(uniforms.uSize, { value: 0.5 }, { value: size, duration: 1.0 });
      gsap.to(uniforms.uRandom, { value: randomness, duration: 1.0 });
      gsap.fromTo(uniforms.uDepth, { value: 40.0 }, { value: depth, duration: 1.5 });
    });

    const applySize = () => {
      view = getSize();
      camera.aspect = view.width / view.height;
      camera.updateProjectionMatrix();
      fovHeight = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z;
      renderer.setSize(view.width, view.height);
      applyScale();
    };
    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    let isInViewport = true;
    let lastRender = 0;
    const frameInterval = 1000 / 30;
    const renderFrame = (timestamp) => {
      if (timestamp - lastRender < frameInterval) return;
      lastRender = timestamp;
      const delta = Math.min(clock.getDelta(), 0.05);
      if (touch) touch.update();
      if (uniforms) uniforms.uTime.value += delta;
      renderer.render(scene, camera);
    };
    const updateAnimationLoop = () => {
      renderer.setAnimationLoop(!disposed && isInViewport && !document.hidden ? renderFrame : null);
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => { isInViewport = entry.isIntersecting; updateAnimationLoop(); }, { rootMargin: "160px" });
    visibilityObserver.observe(container);
    document.addEventListener("visibilitychange", updateAnimationLoop);
    updateAnimationLoop();

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", updateAnimationLoop);
      canvas.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      if (uniforms) gsap.killTweensOf([uniforms.uSize, uniforms.uRandom, uniforms.uDepth]);
      if (object3D) { object3D.geometry.dispose(); object3D.material.dispose(); }
      if (hitArea) { hitArea.geometry.dispose(); hitArea.material.dispose(); }
      if (touch) touch.texture.dispose();
      renderer.dispose();
    };
  }, [src, color, size, randomness, depth, touchRadius, threshold, maxDimension]);

  return (
    <div ref={containerRef} className={cn("relative h-full w-full overflow-hidden", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <canvas ref={canvasRef} className="block h-full w-full" style={{ touchAction: "pan-y" }} />
    </div>
  );
}

export default InteractiveParticles;
