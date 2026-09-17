// Inhalte · Welcome-Screen (erster Onboarding-Slide, §39.8)
// -------------------------------------------------------------------------
// Diese Datei ist zum Ändern da: Texte und Grafik stehen hier, nicht im Code.
// Nach einer Änderung `node build.mjs` (oder `node gen-ui.mjs`) laufen lassen.
//
// Felder:
//   svg        Grafik der Bildbühne (240 px hoch, dunkler Grund). Volle
//              <svg>-Auszeichnung, skaliert über width/height="100%".
//   titel      { de, en } — Headline, höchstens 12 Wörter.
//   text       { de, en } — Subline, höchstens zwei Sätze.
//   primaer    { de, en } — Beschriftung der primären Schaltfläche.
//   sekundaer  { de, en } — Beschriftung der sekundären Schaltfläche.
export default {
  svg: `<svg viewBox="0 0 320 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
  <defs>
    <pattern id="wGitter" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M16 0 H0 V16" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
    <linearGradient id="wGrund" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f2a3d"/>
      <stop offset="1" stop-color="#1b1922"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" fill="url(#wGrund)"/>
  <rect width="320" height="240" fill="url(#wGitter)"/>
  <g transform="translate(40 68)">
    <rect x="0" y="56" width="28" height="28" rx="6" fill="#0d99ff" fill-opacity=".45"/>
    <rect x="36" y="40" width="44" height="44" rx="9" fill="#0d99ff" fill-opacity=".7"/>
    <rect x="88" y="16" width="68" height="68" rx="14" fill="#0d99ff"/>
  </g>
  <g fill="none" stroke="#8a8a96" stroke-width="2" stroke-linecap="round">
    <path d="M214 96 h28 m-8 -8 l8 8 l-8 8"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="2">
    <rect x="256" y="64" width="40" height="40" rx="8"/>
    <rect x="256" y="116" width="30" height="30" rx="7"/>
    <rect x="256" y="158" width="22" height="22" rx="5"/>
  </g>
</svg>`,
  titel: {
    de: 'Willkommen bei Icon Pipeline',
    en: 'Welcome to Icon Pipeline'
  },
  text: {
    de: 'Aus einer Vorlage entstehen alle Zielgrößen — pixelgenau gerastert und als Varianten abgelegt.',
    en: 'One source becomes every target size — snapped to the pixel grid and stored as variants.'
  },
  primaer: { de: 'Rundgang starten', en: 'Start the tour' },
  sekundaer: { de: 'Direkt loslegen', en: 'Jump right in' }
};
