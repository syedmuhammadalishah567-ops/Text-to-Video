"use client";

import { useEffect } from "react";
import { SITE } from "@/lib/site";
import styles from "./AdSlot.module.css";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({ slot, format = "auto" }: { slot?: string; format?: "auto" | "horizontal" | "rectangle" }) {
  const live = Boolean(SITE.adsenseClient && slot);

  useEffect(() => {
    if (!live) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [live]);

  if (!live) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div className={styles.placeholder} aria-hidden>
        Ad space · {format}
      </div>
    );
  }

  return (
    <div className={styles.slot}>
      <span className={styles.label}>Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={SITE.adsenseClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
