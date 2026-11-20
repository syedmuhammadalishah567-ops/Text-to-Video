import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import Link from "next/link";
import { SITE } from "@/lib/site";
import "./globals.css";
import styles from "./layout.module.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `Image to Video Free: Turn a Photo into a 3D Moving Video | ${SITE.name}`,
    template: `%s | ${SITE.name}`,
  },
  description:
    "Turn any photo into a moving video with 3D camera motion, snow, rain, fog and film effects. Free, no watermark, no sign-up. Runs in your browser, so your photo is never uploaded.",
  openGraph: { siteName: SITE.name, type: "website" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceaf1" },
    { media: "(prefers-color-scheme: dark)", color: "#121017" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable}`}>
      <body>
        {SITE.adsenseClient && (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}`}
          />
        )}
        <header className="wrap">
          <div className={styles.header}>
            <Link href="/" className={styles.logo}>
              <span className={styles.mark} aria-hidden />
              {SITE.name}
            </Link>
            <span className={styles.tag}>Free · No watermark · Private</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className={styles.footer}>
          <div className={`wrap ${styles.footerInner}`}>
            <div>
              <p className={styles.footerName}>{SITE.name}</p>
              <p className={styles.footerNote}>
                Photos are processed on your device. Depth model: Depth Anything V2 Small (Apache 2.0).
              </p>
            </div>
            <ul className={styles.footerLinks}>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
