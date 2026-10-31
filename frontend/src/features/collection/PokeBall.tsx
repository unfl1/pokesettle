import { useId } from 'react';
import styles from './collection.module.css';

export default function PokeBall({ shaking }: { shaking: boolean }) {
  const id = useId();
  return <svg viewBox="0 0 96 96" className={`${styles.ball} ${shaking ? styles.shaking : ''}`} aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-red`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#ff5b5b" /><stop offset=".5" stopColor="#ed232d" /><stop offset="1" stopColor="#ad0b1b" />
      </linearGradient>
      <linearGradient id={`${id}-white`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#fff" /><stop offset=".6" stopColor="#f7f8fa" /><stop offset="1" stopColor="#aeb7c4" />
      </linearGradient>
      <radialGradient id={`${id}-shade`} cx=".3" cy=".2" r=".85">
        <stop offset=".5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#08111e" stopOpacity=".28" />
      </radialGradient>
      <clipPath id={`${id}-clip`}><circle cx="48" cy="48" r="43" /></clipPath>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <circle cx="48" cy="48" r="43" fill={`url(#${id}-white)`} />
      <path d="M5 48a43 43 0 0 1 86 0Z" fill={`url(#${id}-red)`} />
      <path d="M3 43q45 9 90 0v10q-45 9-90 0Z" fill="#181b23" />
      <circle cx="48" cy="48" r="43" fill={`url(#${id}-shade)`} />
      <ellipse cx="29" cy="22" rx="15" ry="6" transform="rotate(-32 29 22)" fill="#fff" opacity=".6" />
    </g>
    <circle cx="48" cy="48" r="43" fill="none" stroke="#181b23" strokeWidth="3.5" />
    <circle cx="48" cy="50" r="14" fill="#181b23" />
    <circle cx="48" cy="50" r="10" fill={`url(#${id}-white)`} />
    <circle className={styles.ballLight} cx="48" cy="50" r="6.5" fill="#fff" stroke="#bbc1c9" strokeWidth="1.5" />
  </svg>;
}
