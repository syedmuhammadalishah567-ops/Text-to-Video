# Stillmotion: image to video

Turns a photo into a short video with 3D camera motion. Everything runs in the visitor's browser:

1. **Depth:** Depth Anything V2 Small (Apache 2.0, commercial use allowed) runs through transformers.js in a Web Worker. It uses WebGPU fp16 when available (50 MB) and WASM q8 otherwise (27 MB). The model downloads from Hugging Face once and is then cached by the browser.
2. **Render:** a WebGL2 shader ray-marches the depth map to move a virtual camera, and a 2D canvas adds particles, film effects and the title.
3. **Export:** MP4 (H.264) through WebCodecs and mediabunny, frame by frame, with a real-time MediaRecorder fallback. GIFs use gifenc with one shared palette.

There are no servers or API costs.

## Run locally

```bash
npm install
npm run dev
```

## Where things live

- `src/lib/moves.ts`: camera move math and the effect list. Add a move here.
- `src/lib/engine.ts`: WebGL shader, particle effects and title rendering.
- `src/lib/depth.ts` and `src/lib/depth.worker.ts`: the AI depth model and depth clean-up.
- `src/lib/export.ts`: MP4 and GIF export.
- `src/components/Studio.tsx`: the tool UI.

## Turning on ads

Same as the text cleaner: set `NEXT_PUBLIC_SITE_URL`, apply for AdSense, then add `NEXT_PUBLIC_ADSENSE_CLIENT` and the slot IDs from `.env.example`.

Before launch, replace `hello@example.com` in the About and Privacy pages.
