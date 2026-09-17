// Inhalte · Lizenz-Karte in den Einstellungen (§39.10)
// -------------------------------------------------------------------------
// Grafik und Text der Karte „Lizenz“. Zum Ändern nur diese Datei anfassen,
// danach `node build.mjs`.
//
// Felder:
//   svg    Skizze links in der Karte (Schloss und Schlüssel, Akzent + Grau,
//          Strichstärke 2). Sie sitzt auf hellem wie dunklem Grund — deshalb
//          keine Flächen, nur Konturen.
//   titel  { de, en } — Überschrift in der Karte.
//   text   { de, en } — ein Satz darunter.
export default {
  svg: `<svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">
  <rect x="6" y="20" width="28" height="22" rx="5" fill="none" stroke="#0d99ff" stroke-width="2"/>
  <path d="M13 20 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke="#8a8a96" stroke-width="2" stroke-linecap="round"/>
  <circle cx="20" cy="30" r="3" fill="#0d99ff"/>
  <path d="M20 33 v4" stroke="#0d99ff" stroke-width="2" stroke-linecap="round"/>
  <circle cx="48" cy="17" r="7" fill="none" stroke="#8a8a96" stroke-width="2"/>
  <path d="M48 24 v16 m0 -11 h6 m-6 6 h5" fill="none" stroke="#8a8a96" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  titel: { de: 'Einmal kaufen, dauerhaft nutzen', en: 'Buy once, use forever' },
  text: {
    de: 'Vorschau und Einzelbau bleiben kostenlos. Alles Weitere schaltet die Vollversion frei.',
    en: 'Preview and single builds stay free. Everything else is unlocked by the full version.'
  }
};
