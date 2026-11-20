"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { estimateDepth } from "@/lib/depth";
import { Renderer, type Look, type Source, type TitlePosition } from "@/lib/engine";
import { exportVideo, frameSize, type Aspect, type ExportFormat } from "@/lib/export";
import { EFFECTS, MOVES, type EffectId, type MoveId, type Strength } from "@/lib/moves";
import MoveGlyph from "./MoveGlyph";
import styles from "./Studio.module.css";

type Stage =
  | { kind: "empty" }
  | { kind: "download"; pct: number }
  | { kind: "analyze" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const FPS = 30;
const REVEAL_MS = 1900;

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

async function loadPhoto(file: Blob) {
  let image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const max = 2048;
  if (Math.max(image.width, image.height) > max) {
    const s = max / Math.max(image.width, image.height);
    const resized = await createImageBitmap(image, {
      resizeWidth: Math.round(image.width * s),
      resizeHeight: Math.round(image.height * s),
      resizeQuality: "high",
    });
    image.close();
    image = resized;
  }
  const s = Math.min(1, 640 / Math.max(image.width, image.height));
  const c = document.createElement("canvas");
  c.width = Math.round(image.width * s);
  c.height = Math.round(image.height * s);
  c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
  const small = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.92));
  return { image, small };
}

function timecode(t: number) {
  const s = Math.floor(t);
  const f = Math.floor((t - s) * FPS);
  return `00:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export default function Studio() {
  const [stage, setStage] = useState<Stage>({ kind: "empty" });
  const [source, setSource] = useState<Source | null>(null);
  const [move, setMove] = useState<MoveId>("pushIn");
  const [effect, setEffect] = useState<EffectId>("none");
  const [strength, setStrength] = useState<Strength>("medium");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [title, setTitle] = useState("");
  const [titlePosition, setTitlePosition] = useState<TitlePosition>("bottom");
  const [format, setFormat] = useState<ExportFormat>("mp4-1080");
  const [showDepth, setShowDepth] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState<{ pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const revealRef = useRef(0);

  const look: Look = { move, effect, strength, duration, title, titlePosition, showDepth };
  const lookRef = useRef(look);
  useEffect(() => {
    lookRef.current = look;
  });
  const exportingRef = useRef(false);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const handleFile = useCallback(async (file: File | Blob | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      if (file) setStage({ kind: "error", message: "That file isn't an image. Use a JPG, PNG or WebP photo." });
      return;
    }
    abortRef.current?.abort();
    setStage({ kind: "analyze" });
    try {
      const { image, small } = await loadPhoto(file);
      const depth = await estimateDepth(small, (s) =>
        setStage(s.kind === "download" ? { kind: "download", pct: s.total ? s.loaded / s.total : 0 } : { kind: "analyze" }),
      );
      setSource((prev) => {
        prev?.image.close();
        return { image, depth };
      });
      revealRef.current = performance.now();
      setShowDepth(false);
      setPlaying(true);
      setStage({ kind: "ready" });
    } catch (err) {
      setStage({
        kind: "error",
        message:
          err instanceof Error && /decode|InvalidState/i.test(err.message)
            ? "This photo couldn't be opened. Try a JPG, PNG or WebP file."
            : "The depth model couldn't run. Check your connection and try again in Chrome or Edge.",
      });
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) handleFile(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const size = frameSize(aspect, 1100, source.image);
    const renderer = new Renderer(source, size.width, size.height, canvas);
    const ctx = canvas.getContext("2d")!;
    const snap = document.createElement("canvas");
    snap.width = size.width;
    snap.height = size.height;

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (exportingRef.current) {
        last = now;
        raf = requestAnimationFrame(loop);
        return;
      }
      const l = lookRef.current;
      const dt = (now - last) / 1000;
      last = now;
      const sinceReveal = now - revealRef.current;
      const revealing = sinceReveal < REVEAL_MS;
      if (playingRef.current && !revealing) t = (t + dt) % l.duration;
      if (revealing) t = 0;

      if (revealing && !l.showDepth) {
        renderer.render(0, { ...l, showDepth: true });
        snap.getContext("2d")!.drawImage(canvas, 0, 0);
        renderer.render(0, l);
        const W = size.width;
        const H = size.height;
        const sweep = Math.min(1, sinceReveal / 900);
        const fade = sinceReveal < 1200 ? 1 : Math.max(0, 1 - (sinceReveal - 1200) / 700);
        const x = sweep * W;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(snap, 0, 0, x, H, 0, 0, x, H);
        if (sweep < 1) {
          ctx.globalAlpha = 1;
          const g = ctx.createLinearGradient(x - 40, 0, x + 2, 0);
          g.addColorStop(0, "rgba(255,90,60,0)");
          g.addColorStop(1, "rgba(255,90,60,0.9)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, 0, 42, H);
          ctx.fillStyle = "#ffc94a";
          ctx.fillRect(x - 1, 0, 2, H);
        }
        ctx.restore();
      } else {
        renderer.render(t, l);
      }
      if (timeRef.current) timeRef.current.textContent = timecode(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [source, aspect]);

  async function runExport() {
    if (!source) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    exportingRef.current = true;
    setExporting({ pct: 0 });
    try {
      const { blob, ext } = await exportVideo(
        source,
        { ...look, showDepth: false },
        aspect,
        format,
        (p) => setExporting({ pct: p }),
        ctrl.signal,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stillmotion-${move}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setStage({ kind: "error", message: "Export failed. Try 720p or GIF, or use Chrome or Edge." });
      }
    } finally {
      exportingRef.current = false;
      setExporting(null);
    }
  }

  const busy = stage.kind === "download" || stage.kind === "analyze";
  const ready = source !== null;
  const exportLabel = format === "gif" ? "Download GIF" : "Download MP4";

  return (
    <section className={styles.studio} aria-label="Image to video studio">
      <div
        className={`${styles.monitor} ${dragging ? styles.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <span className={`${styles.corner} ${styles.tl}`} aria-hidden />
        <span className={`${styles.corner} ${styles.tr}`} aria-hidden />
        <span className={`${styles.corner} ${styles.bl}`} aria-hidden />
        <span className={`${styles.corner} ${styles.br}`} aria-hidden />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className={styles.screen}>
          {ready ? (
            <canvas ref={canvasRef} className={styles.canvas} />
          ) : (
            <button className={styles.drop} onClick={() => fileRef.current?.click()} disabled={busy}>
              <span className={styles.dropTitle}>{busy ? "Reading your photo" : "Drop a photo here"}</span>
              <span className={styles.dropSub}>
                {busy ? "This takes a few seconds" : "or click to choose one. You can also paste an image."}
              </span>
              {!busy && <span className={styles.dropFormats}>JPG · PNG · WebP</span>}
            </button>
          )}

          {busy && (
            <div className={styles.status} role="status">
              <span className={styles.statusLabel}>
                {stage.kind === "download"
                  ? `Downloading depth model · ${Math.round(stage.pct * 100)}%`
                  : "Mapping depth"}
              </span>
              <span className={styles.bar}>
                <span
                  className={`${styles.barFill} ${stage.kind === "analyze" ? styles.barIndeterminate : ""}`}
                  style={stage.kind === "download" ? { width: `${stage.pct * 100}%` } : undefined}
                />
              </span>
              {stage.kind === "download" && <span className={styles.statusNote}>One-time download, then cached</span>}
            </div>
          )}

          {exporting && (
            <div className={styles.status} role="status">
              <span className={styles.statusLabel}>Rendering · {Math.round(exporting.pct * 100)}%</span>
              <span className={styles.bar}>
                <span className={styles.barFill} style={{ width: `${exporting.pct * 100}%` }} />
              </span>
              <button className={styles.cancel} onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className={styles.transport}>
          {ready ? (
            <>
              <button
                className={styles.play}
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause preview" : "Play preview"}
              >
                {playing ? (
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <rect x="3" y="2" width="3.5" height="12" rx="1" />
                    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <path d="M4 2.5v11l9.5-5.5z" />
                  </svg>
                )}
              </button>
              <span ref={timeRef} className={styles.timecode}>
                00:00:00
              </span>
              <span className={styles.dur}>/ 00:{String(duration).padStart(2, "0")}:00</span>
              <span className={styles.spacer} />
              <button
                className={`${styles.tbtn} ${showDepth ? styles.tbtnOn : ""}`}
                aria-pressed={showDepth}
                onClick={() => setShowDepth((d) => !d)}
              >
                <span className={styles.depthSwatch} aria-hidden />
                Depth
              </button>
              <button className={styles.tbtn} onClick={() => fileRef.current?.click()} disabled={busy}>
                Replace photo
              </button>
            </>
          ) : (
            <span className={styles.transportIdle}>Runs on your device. Your photo is never uploaded.</span>
          )}
        </div>

        {stage.kind === "error" && (
          <p className={styles.error} role="alert">
            {stage.message}
          </p>
        )}
      </div>

      <div className={styles.panel}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Camera move</legend>
          <div className={styles.moves}>
            {MOVES.map((m) => (
              <button
                key={m.id}
                className={`${styles.move} ${move === m.id ? `${styles.moveOn} is-live` : ""}`}
                aria-pressed={move === m.id}
                title={m.hint}
                onClick={() => setMove(m.id)}
                onMouseEnter={(e) => e.currentTarget.classList.add("is-live")}
                onMouseLeave={(e) => move !== m.id && e.currentTarget.classList.remove("is-live")}
              >
                <MoveGlyph move={m.id} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Effect</legend>
          <div className={styles.chips}>
            {EFFECTS.map((f) => (
              <button
                key={f.id}
                className={styles.chip}
                aria-pressed={effect === f.id}
                onClick={() => setEffect(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.row}>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Motion</legend>
            <Segmented
              label="Motion strength"
              value={strength}
              onChange={setStrength}
              options={[
                { id: "subtle", label: "Subtle" },
                { id: "medium", label: "Medium" },
                { id: "strong", label: "Strong" },
              ]}
            />
          </fieldset>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Length</legend>
            <Segmented
              label="Video length"
              value={String(duration) as "5" | "10"}
              onChange={(v) => setDuration(Number(v))}
              options={[
                { id: "5", label: "5s" },
                { id: "10", label: "10s" },
              ]}
            />
          </fieldset>
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Frame</legend>
          <Segmented
            label="Aspect ratio"
            value={aspect}
            onChange={setAspect}
            options={[
              { id: "16:9", label: "16:9" },
              { id: "9:16", label: "9:16" },
              { id: "1:1", label: "1:1" },
              { id: "original", label: "Original" },
            ]}
          />
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Title</legend>
          <input
            className={styles.input}
            value={title}
            maxLength={60}
            placeholder="Add text on top (optional)"
            onChange={(e) => setTitle(e.target.value)}
          />
          {title.trim() && (
            <Segmented
              label="Title position"
              value={titlePosition}
              onChange={setTitlePosition}
              options={[
                { id: "top", label: "Top" },
                { id: "middle", label: "Middle" },
                { id: "bottom", label: "Bottom" },
              ]}
            />
          )}
        </fieldset>

        <div className={styles.exportBox}>
          <Segmented
            label="Export format"
            value={format}
            onChange={setFormat}
            options={[
              { id: "mp4-1080", label: "MP4 1080p" },
              { id: "mp4-720", label: "MP4 720p" },
              { id: "gif", label: "GIF" },
            ]}
          />
          <button className={styles.export} disabled={!ready || !!exporting} onClick={runExport}>
            <span className={styles.rec} aria-hidden />
            {exporting ? "Rendering…" : exportLabel}
          </button>
          <p className={styles.exportNote}>Free, no watermark, no sign-up.</p>
        </div>
      </div>
    </section>
  );
}
