import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeVideo } from "mediabunny";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { Renderer, type Look, type Source } from "./engine";

export type ExportFormat = "mp4-1080" | "mp4-720" | "gif";
export type Aspect = "16:9" | "9:16" | "1:1" | "original";

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function frameSize(aspect: Aspect, longSide: number, image: { width: number; height: number }) {
  const ratio =
    aspect === "16:9" ? 16 / 9 : aspect === "9:16" ? 9 / 16 : aspect === "1:1" ? 1 : image.width / image.height;
  return ratio >= 1
    ? { width: even(longSide), height: even(longSide / ratio) }
    : { width: even(longSide * ratio), height: even(longSide) };
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export async function exportVideo(
  source: Source,
  look: Look,
  aspect: Aspect,
  format: ExportFormat,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  if (format === "gif") return exportGif(source, look, aspect, onProgress, signal);

  const size = frameSize(aspect, format === "mp4-1080" ? 1920 : 1280, source.image);
  const fps = 30;
  const renderer = new Renderer(source, size.width, size.height);
  try {
    const supported = typeof VideoEncoder !== "undefined" && (await canEncodeVideo("avc", size));
    if (!supported) return await recordFallback(renderer, look, fps, onProgress, signal);

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const src = new CanvasSource(renderer.canvas, { codec: "avc", bitrate: QUALITY_HIGH });
    output.addVideoTrack(src, { frameRate: fps });
    await output.start();
    const total = Math.round(look.duration * fps);
    for (let i = 0; i < total; i++) {
      if (signal.aborted) {
        await output.cancel();
        throw new DOMException("Export cancelled", "AbortError");
      }
      renderer.render(i / fps, look);
      await src.add(i / fps, 1 / fps);
      onProgress((i + 1) / total);
      if (i % 5 === 0) await nextFrame();
    }
    await output.finalize();
    return { blob: new Blob([output.target.buffer!], { type: "video/mp4" }), ext: "mp4" };
  } finally {
    renderer.dispose();
  }
}

async function recordFallback(
  renderer: Renderer,
  look: Look,
  fps: number,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  const stream = renderer.canvas.captureStream(fps);
  const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (signal.aborted || t >= look.duration) return resolve();
      renderer.render(t, look);
      onProgress(t / look.duration);
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  await done;
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const type = rec.mimeType || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}

async function exportGif(
  source: Source,
  look: Look,
  aspect: Aspect,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  const size = frameSize(aspect, 480, source.image);
  const fps = 15;
  const renderer = new Renderer(source, size.width, size.height);
  const read = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  read.canvas.width = size.width;
  read.canvas.height = size.height;
  try {
    const grab = (t: number) => {
      renderer.render(t, look);
      read.drawImage(renderer.canvas, 0, 0);
      return read.getImageData(0, 0, size.width, size.height).data;
    };

    const samples = 6;
    const frameBytes = size.width * size.height * 4;
    const pool = new Uint8ClampedArray(frameBytes * samples);
    for (let s = 0; s < samples; s++) pool.set(grab((s / samples) * look.duration), s * frameBytes);
    const palette = quantize(pool, 256);

    const gif = GIFEncoder();
    const total = Math.round(look.duration * fps);
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const data = grab(i / fps);
      gif.writeFrame(applyPalette(data, palette), size.width, size.height, { palette, delay: 1000 / fps });
      onProgress((i + 1) / total);
      if (i % 3 === 0) await nextFrame();
    }
    gif.finish();
    return { blob: new Blob([gif.bytes() as BlobPart], { type: "image/gif" }), ext: "gif" };
  } finally {
    renderer.dispose();
  }
}
