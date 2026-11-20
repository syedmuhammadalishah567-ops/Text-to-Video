export type DepthMap = { data: Uint8Array; width: number; height: number; focus: number };

type WorkerMsg =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "depth"; id: number; width: number; height: number; data: Uint8Array }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  if (!worker) worker = new Worker(new URL("./depth.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function estimateDepth(
  input: Blob,
  onStage: (stage: { kind: "download"; loaded: number; total: number } | { kind: "analyze" }) => void,
): Promise<DepthMap> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerMsg>) => {
      const m = e.data;
      if (m.type === "progress") onStage({ kind: "download", loaded: m.loaded, total: m.total });
      else if (m.type === "ready") onStage({ kind: "analyze" });
      else if (m.id === id) {
        w.removeEventListener("message", onMessage);
        if (m.type === "error") reject(new Error(m.message));
        else resolve(refine(m.data, m.width, m.height));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, blob: input });
  });
}

function maxFilter(src: Uint8Array, w: number, h: number, r: number) {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, src[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]);
      out[y * w + x] = m;
    }
  }
  return out;
}

function boxBlur(src: Uint8Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++, n++) s += src[y * w + k];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++, n++) s += tmp[k * w + x];
      out[y * w + x] = Math.round(s / n);
    }
  }
  return out;
}

function refine(raw: Uint8Array, w: number, h: number): DepthMap {
  const r = Math.max(1, Math.round(Math.max(w, h) / 260));
  let d = maxFilter(raw, w, h, r);
  d = boxBlur(d, w, h, r);
  d = boxBlur(d, w, h, r);

  const values: number[] = [];
  for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 2) {
    for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 2) values.push(d[y * w + x]);
  }
  values.sort((a, b) => a - b);
  const p75 = values[Math.floor(values.length * 0.75)] / 255;
  return { data: d, width: w, height: h, focus: Math.min(0.9, Math.max(0.3, p75)) };
}
