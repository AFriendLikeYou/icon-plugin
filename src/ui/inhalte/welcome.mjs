// Inhalte · Welcome-Screen (erster Onboarding-Slide, §39.8)
// -------------------------------------------------------------------------
// Diese Datei ist zum Ändern da: Texte und Grafik stehen hier, nicht im Code.
// Nach einer Änderung `node build.mjs` (oder `node gen-ui.mjs`) laufen lassen.
//
// Felder:
//   animiert     true  → `svg` (animierte Fassung) wird gezeigt
//                false → `svgStatisch` wird gezeigt (Endzustand, kein CSS)
//   svg          Grafik der Bildbühne (240 px hoch, dunkler Grund). Volle
//                <svg>-Auszeichnung, skaliert über width/height="100%".
//   svgStatisch  dieselbe Szene ohne Animation — Rückfallebene.
//   titel        { de, en } — Headline, höchstens 12 Wörter.
//   text         { de, en } — Subline, höchstens zwei Sätze.
//   primaer      { de, en } — Beschriftung der primären Schaltfläche.
//   sekundaer    { de, en } — Beschriftung der sekundären Schaltfläche.
//
// Zur Animation: siehe docs/INHALTE.md, Abschnitt „Animierte Welcome-Grafik“.
// Kurz: ein 6-s-Loop (4,5 s Bewegung + 1,5 s Pause). Die Vorlage links
// „zerfällt“, drei Kästen im Verhältnis 24/18/14 fliegen nach rechts und
// rasten mit leichtem Überschwingen ein; danach blitzen kurz Rasterlinien
// auf. Die Keyframes hängen an der Klasse `.an`, die die Logik am Container
// (#obBild) setzt, solange der Dialog offen ist — geschlossen = keine
// Animation. `prefers-reduced-motion: reduce` zeigt nur den Endzustand.
export default {
  animiert: true,

  svg: `<svg class="ipw" viewBox="0 0 320 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Eine Vorlage wird zu drei Icon-Groessen">
  <style>
    /* Farben: eine Akzentfarbe plus Grau, Striche 2, Gitter sehr dezent. */
    .ipw { --ipw-akzent: var(--figma-color-bg-brand, #0d99ff); --ipw-grau: #8a8a96; }
    .ipw .ipw-akzent { stroke: var(--ipw-akzent); }
    .ipw .ipw-grau   { stroke: var(--ipw-grau); }
    /* Alle beweglichen Teile drehen/skalieren um ihre eigene Mitte. */
    .ipw .ipw-vorlage, .ipw .ipw-kasten { transform-box: fill-box; transform-origin: center; }
    /* Ruhezustand = Endzustand: die drei Kaesten sitzen, die Vorlage blass.
       Genau das sieht man auch bei geschlossenem Dialog und bei
       prefers-reduced-motion. */
    .ipw .ipw-vorlage { opacity: .2; }
    .ipw .ipw-kasten  { opacity: 1; }
    .ipw .ipw-raster  { opacity: 0; }

    /* --- Loop: 6 s, davon 4,5 s Bewegung und 1,5 s Pause (75 % .. 100 %) --- */
    .an .ipw-vorlage   { animation: ipwVorlage 6s linear infinite; }
    .an .ipw-pfeil     { animation: ipwPfeil   6s linear infinite; }
    .an .ipw-kasten-a  { animation: ipwKastenA 6s linear infinite; }
    .an .ipw-kasten-b  { animation: ipwKastenB 6s linear infinite; }
    .an .ipw-kasten-c  { animation: ipwKastenC 6s linear infinite; }
    .an .ipw-raster-a  { animation: ipwRasterA 6s linear infinite; }
    .an .ipw-raster-b  { animation: ipwRasterB 6s linear infinite; }
    .an .ipw-raster-c  { animation: ipwRasterC 6s linear infinite; }

    @keyframes ipwVorlage {
      0%, 8%    { opacity: 1;  transform: scale(1); }
      16%, 68%  { opacity: .2; transform: scale(.94); }
      75%, 100% { opacity: 1;  transform: scale(1); }
    }
    @keyframes ipwPfeil {
      0%, 8%    { opacity: 0; }
      14%, 66%  { opacity: 1; }
      72%, 100% { opacity: 0; }
    }
    /* Kasten A (gross, 24): abloesen 10 %, einrasten 18,33 %, setzen 22 % */
    @keyframes ipwKastenA {
      0%     { opacity: 0; transform: translate(-154px, 54px) scale(.4); }
      10%    { opacity: 0; transform: translate(-154px, 54px) scale(.4);
               animation-timing-function: cubic-bezier(.2,.85,.25,1); }
      11%    { opacity: 1; }
      18.33% { transform: translate(7px, -3px) scale(1.07);
               animation-timing-function: cubic-bezier(.4,0,.6,1); }
      22%    { transform: translate(0, 0) scale(1); }
      70%    { opacity: 1; transform: translate(0, 0) scale(1); }
      75%    { opacity: 0; transform: translate(-154px, 54px) scale(.4); }
      100%   { opacity: 0; transform: translate(-154px, 54px) scale(.4); }
    }
    /* Kasten B (mittel, 18): 20 % .. 32 % */
    @keyframes ipwKastenB {
      0%     { opacity: 0; transform: translate(-145px, -19px) scale(.4); }
      20%    { opacity: 0; transform: translate(-145px, -19px) scale(.4);
               animation-timing-function: cubic-bezier(.2,.85,.25,1); }
      21%    { opacity: 1; }
      28.33% { transform: translate(6px, 3px) scale(1.07);
               animation-timing-function: cubic-bezier(.4,0,.6,1); }
      32%    { transform: translate(0, 0) scale(1); }
      70%    { opacity: 1; transform: translate(0, 0) scale(1); }
      75%    { opacity: 0; transform: translate(-145px, -19px) scale(.4); }
      100%   { opacity: 0; transform: translate(-145px, -19px) scale(.4); }
    }
    /* Kasten C (klein, 14): 30 % .. 42 % */
    @keyframes ipwKastenC {
      0%     { opacity: 0; transform: translate(-139px, -77px) scale(.4); }
      30%    { opacity: 0; transform: translate(-139px, -77px) scale(.4);
               animation-timing-function: cubic-bezier(.2,.85,.25,1); }
      31%    { opacity: 1; }
      38.33% { transform: translate(5px, 4px) scale(1.07);
               animation-timing-function: cubic-bezier(.4,0,.6,1); }
      42%    { transform: translate(0, 0) scale(1); }
      70%    { opacity: 1; transform: translate(0, 0) scale(1); }
      75%    { opacity: 0; transform: translate(-139px, -77px) scale(.4); }
      100%   { opacity: 0; transform: translate(-139px, -77px) scale(.4); }
    }
    /* Rasterlinien blitzen direkt nach dem Einrasten kurz auf. */
    @keyframes ipwRasterA { 0%, 17% { opacity: 0; } 20% { opacity: .8; } 28%, 100% { opacity: 0; } }
    @keyframes ipwRasterB { 0%, 27% { opacity: 0; } 30% { opacity: .8; } 38%, 100% { opacity: 0; } }
    @keyframes ipwRasterC { 0%, 37% { opacity: 0; } 40% { opacity: .8; } 48%, 100% { opacity: 0; } }

    /* Barrierefreiheit: keine Bewegung, nur der Endzustand. */
    @media (prefers-reduced-motion: reduce) {
      .ipw .ipw-vorlage, .ipw .ipw-pfeil, .ipw .ipw-kasten, .ipw .ipw-raster {
        animation: none !important; opacity: 1; transform: none;
      }
      .ipw .ipw-vorlage { opacity: .2; }
      .ipw .ipw-raster  { opacity: 0; }
    }
  </style>
  <defs>
    <pattern id="ipwGitter" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M16 0 H0 V16" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
    <linearGradient id="ipwGrund" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f2a3d"/>
      <stop offset="1" stop-color="#1b1922"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" fill="url(#ipwGrund)"/>
  <rect width="320" height="240" fill="url(#ipwGitter)"/>

  <!-- Vorlage: grosser Kasten mit Icon-Umriss -->
  <g class="ipw-vorlage" fill="none" stroke-width="2">
    <rect class="ipw-akzent" x="32" y="70" width="100" height="100" rx="14"/>
    <rect class="ipw-grau" x="52" y="90" width="60" height="60" rx="10" stroke-dasharray="5 4"/>
    <path class="ipw-grau" d="M66 132 l14 -18 l12 14 l10 -12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Pfeil -->
  <path class="ipw-pfeil ipw-grau" d="M152 120 h28 m-9 -9 l9 9 l-9 9" fill="none" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Rasterlinien je Landeplatz -->
  <g class="ipw-raster ipw-raster-a ipw-akzent" fill="none" stroke-width="1" stroke-dasharray="3 3">
    <path d="M200 14 V118 M272 14 V118 M184 30 H288 M184 102 H288"/>
  </g>
  <g class="ipw-raster ipw-raster-b ipw-akzent" fill="none" stroke-width="1" stroke-dasharray="3 3">
    <path d="M200 98 V180 M254 98 V180 M186 112 H268 M186 166 H268"/>
  </g>
  <g class="ipw-raster ipw-raster-c ipw-akzent" fill="none" stroke-width="1" stroke-dasharray="3 3">
    <path d="M200 164 V230 M242 164 V230 M188 176 H254 M188 218 H254"/>
  </g>

  <!-- Die drei Zielgroessen, Verhaeltnis 24 / 18 / 14 (hier 3-fach gezeichnet) -->
  <rect class="ipw-kasten ipw-kasten-a ipw-akzent" x="200" y="30" width="72" height="72" rx="14" fill="none" stroke-width="2"/>
  <rect class="ipw-kasten ipw-kasten-b ipw-akzent" x="200" y="112" width="54" height="54" rx="11" fill="none" stroke-width="2"/>
  <rect class="ipw-kasten ipw-kasten-c ipw-akzent" x="200" y="176" width="42" height="42" rx="9" fill="none" stroke-width="2"/>
</svg>`,

  svgStatisch: `<svg class="ipw" viewBox="0 0 320 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Eine Vorlage wird zu drei Icon-Groessen">
  <defs>
    <pattern id="ipwGitter" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M16 0 H0 V16" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
    <linearGradient id="ipwGrund" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f2a3d"/>
      <stop offset="1" stop-color="#1b1922"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" fill="url(#ipwGrund)"/>
  <rect width="320" height="240" fill="url(#ipwGitter)"/>
  <g fill="none" stroke-width="2" opacity=".35">
    <rect x="32" y="70" width="100" height="100" rx="14" stroke="#0d99ff"/>
    <rect x="52" y="90" width="60" height="60" rx="10" stroke="#8a8a96" stroke-dasharray="5 4"/>
    <path d="M66 132 l14 -18 l12 14 l10 -12" stroke="#8a8a96" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <path d="M152 120 h28 m-9 -9 l9 9 l-9 9" fill="none" stroke="#8a8a96" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="none" stroke="#0d99ff" stroke-width="2">
    <rect x="200" y="30" width="72" height="72" rx="14"/>
    <rect x="200" y="112" width="54" height="54" rx="11"/>
    <rect x="200" y="176" width="42" height="42" rx="9"/>
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
