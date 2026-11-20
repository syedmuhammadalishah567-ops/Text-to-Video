import Studio from "@/components/Studio";
import AdSlot from "@/components/AdSlot";
import MoveGlyph from "@/components/MoveGlyph";
import { MOVES } from "@/lib/moves";
import { SITE } from "@/lib/site";
import styles from "./page.module.css";

const STEPS = [
  {
    title: "Add a photo",
    text: "Drop in a JPG, PNG or WebP. Portraits, products, landscapes and illustrations all work.",
  },
  {
    title: "The model maps depth",
    text: "Depth Anything V2 runs in your browser and works out how far away every pixel is. Press Depth to see what it found.",
  },
  {
    title: "Pick a move and download",
    text: "Choose a camera move and an effect, then download an MP4 in 1080p or a looping GIF.",
  },
];

const FAQ = [
  {
    q: "Is this image to video tool really free?",
    a: "Yes. There's no sign-up, no watermark and no limit on how many videos you make.",
  },
  {
    q: "Is my photo uploaded to a server?",
    a: "No. The depth model and the video rendering both run on your device. Your photo never leaves your browser.",
  },
  {
    q: "Is this AI video generation?",
    a: "It's AI depth, not generative video. An AI model measures how far away each part of your photo is, then a virtual camera moves through the scene. Nothing in your photo is invented or changed, so faces and products stay exactly as they are.",
  },
  {
    q: "Why does the first video take longer?",
    a: "The first time, your browser downloads the depth model (about 27 MB). It's saved by your browser, so every photo after that starts in a few seconds.",
  },
  {
    q: "Which browser works best?",
    a: "Chrome and Edge export an MP4 in a few seconds. Other browsers record the video in real time, so a 10-second clip takes about 10 seconds.",
  },
  {
    q: "What size should I use for Instagram Reels or TikTok?",
    a: "Choose 9:16 for Reels, TikTok and YouTube Shorts, 1:1 for feed posts, and 16:9 for YouTube and presentations.",
  },
];

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <section className={styles.hero}>
          <h1 className={styles.title}>
            Make a still photo <span className={styles.move}>move</span>
          </h1>
          <p className={styles.intro}>
            Turn any image into a video with real 3D camera motion. An AI depth model runs in your browser, works out
            what&rsquo;s near and far, and moves a camera through the scene. Free, no watermark.
          </p>
        </section>

        <Studio />

        <AdSlot slot={SITE.adSlots.afterTool} format="horizontal" />

        <section className={styles.section} aria-labelledby="how">
          <h2 id="how" className={styles.sectionTitle}>
            How it works
          </h2>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.title} className={styles.step}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="moves">
          <h2 id="moves" className={styles.sectionTitle}>
            Eight camera moves
          </h2>
          <ul className={styles.moves}>
            {MOVES.map((m) => (
              <li key={m.id} className={`${styles.moveCard} is-live`}>
                <MoveGlyph move={m.id} />
                <div>
                  <strong>{m.label}</strong>
                  <span>{m.hint}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <AdSlot slot={SITE.adSlots.inContent} />

        <section className={styles.section} aria-labelledby="faq">
          <h2 id="faq" className={styles.sectionTitle}>
            Questions
          </h2>
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={styles.qa}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
