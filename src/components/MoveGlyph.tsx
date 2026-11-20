import type { MoveId } from "@/lib/moves";
import styles from "./MoveGlyph.module.css";

export default function MoveGlyph({ move }: { move: MoveId }) {
  return (
    <svg className={`${styles.glyph} ${styles[move]}`} viewBox="0 0 48 32" aria-hidden>
      <defs>
        <clipPath id={`clip-${move}`}>
          <rect x="1" y="1" width="46" height="30" rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${move})`}>
        <g className={styles.scene}>
          <g className={styles.back}>
            <path d="M-12 26 L4 13 L12 19 L22 8 L36 22 L44 15 L60 26 Z" />
          </g>
          <g className={styles.front}>
            <circle cx="24" cy="21" r="5.5" />
            <rect x="19" y="26" width="10" height="8" rx="3" />
          </g>
        </g>
      </g>
      <rect className={styles.frame} x="1" y="1" width="46" height="30" rx="3" />
    </svg>
  );
}
