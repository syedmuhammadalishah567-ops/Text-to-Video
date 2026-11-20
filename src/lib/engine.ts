import type { DepthMap } from "./depth";
import { camera, overscan, type EffectId, type MoveId, type Strength } from "./moves";

export type TitlePosition = "top" | "middle" | "bottom";

export type Look = {
  move: MoveId;
  effect: EffectId;
  strength: Strength;
  duration: number;
  title: string;
  titlePosition: TitlePosition;
  showDepth: boolean;
};

export type Source = { image: ImageBitmap; depth: DepthMap };

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uCover;
uniform float uZoom;
uniform vec2 uPan;
uniform vec2 uShift;
uniform float uDolly;
uniform float uFocus;
uniform float uFog;
uniform float uTime;
uniform int uView;

float depthAt(vec2 p) { return texture(uDepth, clamp(p, 0.001, 0.999)).r; }

vec3 depthRamp(float d) {
  vec3 c0 = vec3(0.141, 0.075, 0.373);
  vec3 c1 = vec3(0.482, 0.173, 0.749);
  vec3 c2 = vec3(1.0, 0.353, 0.235);
  vec3 c3 = vec3(1.0, 0.788, 0.290);
  if (d < 0.33) return mix(c0, c1, d / 0.33);
  if (d < 0.66) return mix(c1, c2, (d - 0.33) / 0.33);
  return mix(c2, c3, (d - 0.66) / 0.34);
}

void main() {
  vec2 base = 0.5 + (vUv - 0.5) * uCover / uZoom + uPan;
  vec2 disp = uShift + (base - 0.5) * uDolly;

  const int STEPS = 56;
  float stepSize = 1.0 / float(STEPS);
  float dPrev = 1.0;
  vec2 qPrev = base - disp * (1.0 - uFocus);
  float diffPrev = depthAt(qPrev) - 1.0;
  vec2 q = base - disp * (0.0 - uFocus);
  for (int i = 0; i <= STEPS; i++) {
    float d = 1.0 - float(i) * stepSize;
    vec2 qi = base - disp * (d - uFocus);
    float diff = depthAt(qi) - d;
    if (diff >= 0.0) {
      float w = i == 0 ? 0.0 : diff / (diff - diffPrev);
      float dHit = mix(d, dPrev, w);
      q = base - disp * (dHit - uFocus);
      break;
    }
    dPrev = d;
    diffPrev = diff;
  }
  q = clamp(q, 0.001, 0.999);

  float dq = depthAt(q);
  if (uView == 1) {
    outColor = vec4(depthRamp(dq), 1.0);
    return;
  }
  vec3 color = texture(uImage, q).rgb;
  if (uFog > 0.0) {
    float drift = 0.85 + 0.15 * sin(uTime * 0.7 + q.x * 5.0 + q.y * 3.0);
    float amt = uFog * pow(1.0 - dq, 1.4) * drift;
    color = mix(color, vec3(0.86, 0.87, 0.9), clamp(amt, 0.0, 0.85));
  }
  outColor = vec4(color, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "Shader error");
  return s;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = { x: number; y: number; z: number; phase: number };

function makeParticles(n: number, seed: number): Particle[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, phase: rnd() * Math.PI * 2 }));
}

function softSprite(color: string, size = 64, hard = 0.0) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(Math.max(0.01, hard), color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function noiseTile(seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private glCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private ctx: CanvasRenderingContext2D;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures: WebGLTexture[] = [];
  private source: Source;
  private particles = {
    snow: makeParticles(240, 11),
    rain: makeParticles(280, 23),
    dust: makeParticles(140, 37),
    bokeh: makeParticles(16, 51),
  };
  private sprites: Record<string, HTMLCanvasElement> = {};
  private grain: HTMLCanvasElement[] = [];
  private font = getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "sans-serif";

  constructor(source: Source, width: number, height: number, canvas?: HTMLCanvasElement) {
    this.source = source;
    this.canvas = canvas ?? document.createElement("canvas");
    this.glCanvas = document.createElement("canvas");
    const gl = this.glCanvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.ctx = this.canvas.getContext("2d")!;
    this.setup();
    this.setSize(width, height);
  }

  setSize(width: number, height: number) {
    this.canvas.width = this.glCanvas.width = width;
    this.canvas.height = this.glCanvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  private setup() {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "Link error");
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of ["uImage", "uDepth", "uCover", "uZoom", "uPan", "uShift", "uDolly", "uFocus", "uFog", "uTime", "uView"]) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }

    const tex = (unit: number) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const { image, depth } = this.source;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.textures.push(tex(0));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.textures.push(tex(1));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, depth.width, depth.height, 0, gl.RED, gl.UNSIGNED_BYTE, depth.data);
    gl.uniform1i(this.uniforms.uImage, 0);
    gl.uniform1i(this.uniforms.uDepth, 1);

    this.sprites.snow = softSprite("rgba(255,255,255,0.95)", 32, 0.35);
    this.sprites.dust = softSprite("rgba(255,214,120,0.95)", 32, 0.15);
    this.sprites.bokeh = softSprite("rgba(255,236,200,0.55)", 128, 0.75);
    this.grain = [noiseTile(1), noiseTile(2), noiseTile(3), noiseTile(4)];
  }

  render(t: number, look: Look) {
    const gl = this.gl;
    const { width: W, height: H } = this.canvas;
    const { image, depth } = this.source;
    const ia = image.width / image.height;
    const fa = W / H;
    const cover: [number, number] = ia > fa ? [fa / ia, 1] : [1, ia / fa];
    const cam = camera(look.move, t, look.duration, look.strength);

    gl.uniform2f(this.uniforms.uCover, cover[0], cover[1]);
    gl.uniform1f(this.uniforms.uZoom, cam.zoom * overscan(look.strength));
    gl.uniform2f(this.uniforms.uPan, cam.pan[0] * cover[0], cam.pan[1] * cover[1]);
    gl.uniform2f(this.uniforms.uShift, cam.shift[0] * cover[0], cam.shift[1] * cover[1]);
    gl.uniform1f(this.uniforms.uDolly, cam.dolly);
    gl.uniform1f(this.uniforms.uFocus, depth.focus);
    gl.uniform1f(this.uniforms.uFog, look.effect === "fog" && !look.showDepth ? 0.75 : 0);
    gl.uniform1f(this.uniforms.uTime, t);
    gl.uniform1i(this.uniforms.uView, look.showDepth ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.glCanvas, 0, 0);
    if (look.showDepth) return;
    this.drawEffect(look.effect, t, W, H);
    this.drawTitle(look, t, W, H);
  }

  private drawEffect(effect: EffectId, t: number, W: number, H: number) {
    const ctx = this.ctx;
    const unit = Math.min(W, H) / 1080;
    if (effect === "snow") {
      for (const p of this.particles.snow) {
        const y = ((p.y + t * (0.04 + 0.1 * p.z)) % 1.1) - 0.05;
        const x = (p.x + 0.015 * Math.sin(t * 0.9 + p.phase) + t * 0.006 * p.z) % 1;
        const s = (4 + 12 * p.z * p.z) * unit;
        ctx.globalAlpha = 0.35 + 0.6 * p.z;
        ctx.drawImage(this.sprites.snow, x * W - s / 2, y * H - s / 2, s, s);
      }
    } else if (effect === "rain") {
      ctx.lineCap = "round";
      for (const p of this.particles.rain) {
        const y = ((p.y + t * (0.9 + 0.9 * p.z)) % 1.2) - 0.1;
        const x = (p.x + y * 0.08) % 1;
        const len = (30 + 70 * p.z) * unit;
        ctx.strokeStyle = `rgba(215,225,245,${0.12 + 0.28 * p.z})`;
        ctx.lineWidth = (1 + 1.5 * p.z) * unit;
        ctx.beginPath();
        ctx.moveTo(x * W, y * H);
        ctx.lineTo(x * W - len * 0.08, y * H - len);
        ctx.stroke();
      }
    } else if (effect === "dust") {
      ctx.globalCompositeOperation = "screen";
      for (const p of this.particles.dust) {
        const y = 1.05 - ((p.y + t * 0.012 * (0.5 + p.z)) % 1.1);
        const x = (p.x + 0.02 * Math.sin(t * 0.5 + p.phase)) % 1;
        const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + p.z * 2) + p.phase * 3);
        const s = (5 + 14 * p.z) * unit;
        ctx.globalAlpha = 0.15 + 0.75 * tw * p.z;
        ctx.drawImage(this.sprites.dust, x * W - s / 2, y * H - s / 2, s, s);
      }
    } else if (effect === "bokeh") {
      ctx.globalCompositeOperation = "screen";
      for (const p of this.particles.bokeh) {
        const x = (p.x + t * 0.008 * (p.z - 0.5) + 0.02 * Math.sin(t * 0.3 + p.phase) + 1) % 1;
        const y = (p.y + 0.02 * Math.cos(t * 0.25 + p.phase) + 1) % 1;
        const s = (90 + 220 * p.z) * unit;
        ctx.globalAlpha = 0.18 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.6 + p.phase));
        ctx.drawImage(this.sprites.bokeh, x * W - s / 2, y * H - s / 2, s, s);
      }
    } else if (effect === "film") {
      const frame = Math.floor(t * 24) % this.grain.length;
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = ctx.createPattern(this.grain[frame], "repeat")!;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "screen";
      const leak = 0.5 + 0.5 * Math.sin(t * 0.9);
      ctx.globalAlpha = 0.12 + 0.28 * leak;
      const g = ctx.createRadialGradient(W * 0.92, H * 0.1, 0, W * 0.92, H * 0.1, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(255,120,40,1)");
      g.addColorStop(0.5, "rgba(255,60,40,0.35)");
      g.addColorStop(1, "rgba(255,60,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 1;
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      v.addColorStop(0, "rgba(255,255,255,1)");
      v.addColorStop(1, "rgba(60,50,45,1)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  private drawTitle(look: Look, t: number, W: number, H: number) {
    const text = look.title.trim();
    if (!text) return;
    const ctx = this.ctx;
    const size = Math.round(Math.min(W, H) * 0.085);
    const appear = Math.min(1, Math.max(0, (t - 0.3) / 0.9));
    const e = 1 - Math.pow(1 - appear, 3);
    const y = look.titlePosition === "top" ? H * 0.16 : look.titlePosition === "middle" ? H * 0.5 : H * 0.84;

    ctx.save();
    ctx.globalAlpha = e;
    ctx.font = `800 ${size}px ${this.font}`;
    if ("fontStretch" in ctx) ctx.fontStretch = "expanded";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = size * 0.04;

    const maxW = W * 0.86;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
    const lh = size * 1.08;
    const startY = y - ((lines.length - 1) * lh) / 2 + (1 - e) * size * 0.5;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));
    ctx.restore();
  }

  dispose() {
    const gl = this.gl;
    this.textures.forEach((t) => gl.deleteTexture(t));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
