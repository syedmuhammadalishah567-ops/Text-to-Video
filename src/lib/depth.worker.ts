import { pipeline, RawImage, env, type DepthEstimationPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL = "onnx-community/depth-anything-v2-small";
let estimator: Promise<DepthEstimationPipeline> | null = null;

type ProgressInfo = { status: string; file?: string; loaded?: number; total?: number };

async function pickDevice(): Promise<{ device: "webgpu" | "wasm"; dtype: "fp16" | "q8" }> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (adapter?.features.has("shader-f16")) return { device: "webgpu", dtype: "fp16" };
  } catch {}
  return { device: "wasm", dtype: "q8" };
}

function load() {
  if (estimator) return estimator;
  estimator = (async () => {
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (p: ProgressInfo) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      files.forEach((f) => {
        loaded += f.loaded;
        total += f.total;
      });
      self.postMessage({ type: "progress", loaded, total });
    };
    const { device, dtype } = await pickDevice();
    try {
      return (await pipeline("depth-estimation", MODEL, { device, dtype, progress_callback })) as DepthEstimationPipeline;
    } catch (err) {
      if (device === "wasm") throw err;
      return (await pipeline("depth-estimation", MODEL, { device: "wasm", dtype: "q8", progress_callback })) as DepthEstimationPipeline;
    }
  })();
  estimator.catch(() => (estimator = null));
  return estimator;
}

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob }>) => {
  const { id, blob } = e.data;
  try {
    const est = await load();
    self.postMessage({ type: "ready" });
    const image = await RawImage.fromBlob(blob);
    const out = await est(image);
    const depth = out.depth;
    const data = new Uint8Array(depth.data);
    self.postMessage({ type: "depth", id, width: depth.width, height: depth.height, data }, { transfer: [data.buffer] });
  } catch (err) {
    self.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
