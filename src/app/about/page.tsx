import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.name} turns still photos into moving videos with 3D camera motion, free and in your browser.`,
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <article className={`wrap ${styles.page}`}>
      <h1>About {SITE.name}</h1>
      <p>
        {SITE.name} turns a single photo into a short video with real 3D camera motion. It&rsquo;s made for
        creators, shops and anyone who wants a photo to stand out in a feed.
      </p>
      <h2>How it works</h2>
      <p>
        An AI depth model, Depth Anything V2 Small, estimates how far away every part of your photo is. A WebGL
        renderer then moves a virtual camera through that depth, so near objects shift more than far ones. Both steps
        run on your device.
      </p>
      <h2>Contact</h2>
      <p>Questions or ideas for a new camera move? Email hello@example.com.</p>
    </article>
  );
}
