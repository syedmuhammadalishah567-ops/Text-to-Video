import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${SITE.name} handles your data.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <article className={`wrap ${styles.page}`}>
      <h1>Privacy policy</h1>
      <p className={styles.updated}>Last updated November 21, 2026</p>

      <h2>Your photos and videos</h2>
      <p>
        Photos you add to {SITE.name} are processed in your browser. They are never uploaded, stored or shared. The
        videos you create are generated on your device and saved directly to it.
      </p>

      <h2>The depth model</h2>
      <p>
        The first time you use the tool, your browser downloads the open-source depth model from Hugging Face and
        caches it. Only the model file is downloaded. No photo data is sent.
      </p>

      <h2>Advertising</h2>
      <p>
        We use Google AdSense to show ads. Google and its partners use cookies to serve ads based on your visits to
        this and other websites. You can opt out of personalized advertising in{" "}
        <a href="https://adssettings.google.com" rel="noopener noreferrer">
          Google Ads Settings
        </a>
        . Learn more about{" "}
        <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer">
          how Google uses data from sites that use its services
        </a>
        .
      </p>

      <h2>Contact</h2>
      <p>For privacy questions, email hello@example.com.</p>
    </article>
  );
}
