// Inhalte · Onboarding-Slides 2 bis 4 (§36, §39.8)
// -------------------------------------------------------------------------
// Slide 1 ist der Welcome-Screen und steht in `welcome.mjs`. Diese Liste
// liefert die folgenden Slides in genau dieser Reihenfolge. Zum Ändern nur
// diese Datei anfassen, danach `node build.mjs`.
//
// Felder je Eintrag:
//   id        technischer Name, frei wählbar, nur für Logs/Tests.
//   titel     { de, en } — höchstens 12 Wörter. Platzhalter {modus} wird
//             durch den erkannten Modus („ZDS“ / „Frei“) ersetzt.
//   text      { de, en } — höchstens zwei Sätze.
//   textZds   optional { de, en } — ersetzt `text`, wenn das ZDS-Board erkannt ist.
//   textFrei  optional { de, en } — ersetzt `text` im freien Modus.
//   svg       Grafik der Bildbühne (volle <svg>-Auszeichnung).
//   svgZds / svgFrei  optional, ersetzen `svg` je nach erkanntem Modus.
//   extra     optional 'profile' (Profilkarten anhängen) oder
//             'lizenz' (Hinweis zum Figma-Kauf anhängen).
//
// Stil der Grafiken: eine Akzentfarbe (#0d99ff) plus Grau (#8a8a96),
// Strichstärke 2, Gitter sehr dezent — wie unsere Icons.
const GITTER = `<defs><pattern id="obGitter" width="16" height="16" patternUnits="userSpaceOnUse">
    <path d="M16 0 H0 V16" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/>
  </pattern></defs><rect width="100%" height="100%" fill="url(#obGitter)"/>`;

export default [
  {
    id: 'modus',
    titel: { de: 'Dein File, dein Modus: {modus}', en: 'Your file, your mode: {modus}' },
    text: {
      de: 'Das Plugin erkennt, wie dieses File gebaut ist. Ein anderes Profil kannst du hier übernehmen.',
      en: 'The plugin detects how this file is built. You can adopt another profile here.'
    },
    textZds: {
      de: 'Das ZDS-Board ist erkannt: Karten, Seiten und bestehendes Set. Ein anderes Profil kannst du hier übernehmen.',
      en: 'The ZDS board is detected: cards, pages and the existing set. You can adopt another profile here.'
    },
    textFrei: {
      de: 'Freier Modus: jede quadratische Komponente im Master-Maß kann Vorlage sein. Wähle ein Profil als Startpunkt.',
      en: 'Free mode: any square component at master size can be a source. Pick a profile as a starting point.'
    },
    svgZds: `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${GITTER}
  <g fill="none" stroke="#8a8a96" stroke-width="2">
    <rect x="62" y="46" width="44" height="44" rx="6"/>
    <rect x="160" y="46" width="44" height="44" rx="6"/>
    <rect x="62" y="110" width="44" height="44" rx="6"/>
    <rect x="111" y="110" width="44" height="44" rx="6"/>
    <rect x="160" y="110" width="44" height="44" rx="6"/>
  </g>
  <rect x="111" y="46" width="44" height="44" rx="6" fill="none" stroke="#0d99ff" stroke-width="2"/>
  <rect x="119" y="54" width="28" height="28" rx="4" fill="none" stroke="#0d99ff" stroke-width="2" stroke-dasharray="4 3"/>
</svg>`,
    svgFrei: `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${GITTER}
  <rect x="110" y="60" width="100" height="80" rx="8" fill="none" stroke="#0d99ff" stroke-width="2"/>
  <rect x="126" y="76" width="68" height="48" rx="6" fill="none" stroke="#0d99ff" stroke-width="2" stroke-dasharray="4 3"/>
  <g fill="#8a8a96">
    <circle cx="110" cy="60" r="4"/><circle cx="210" cy="60" r="4"/>
    <circle cx="110" cy="140" r="4"/><circle cx="210" cy="140" r="4"/>
  </g>
</svg>`,
    svg: `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${GITTER}
  <rect x="110" y="60" width="100" height="80" rx="8" fill="none" stroke="#0d99ff" stroke-width="2"/>
</svg>`,
    extra: 'profile'
  },
  {
    id: 'ablauf',
    titel: { de: 'Auswählen, ansehen, bauen', en: 'Select, review, build' },
    text: {
      de: 'Vorlage wählen, Vorschau prüfen, Icon bauen — ein Trockenlauf zeigt vorher, was passiert. Jeder Bau lässt sich rückgängig machen.',
      en: 'Pick a source, check the preview, build the icon — a dry run shows what will happen. Every build can be undone.'
    },
    svg: `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${GITTER}
  <g fill="none" stroke="#8a8a96" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="30" y="78" width="52" height="52" rx="8"/>
    <path d="M94 104 h20 m-7 -7 l7 7 l-7 7"/>
    <rect x="126" y="78" width="52" height="52" rx="8"/>
    <path d="M190 104 h20 m-7 -7 l7 7 l-7 7"/>
  </g>
  <rect x="222" y="78" width="52" height="52" rx="8" fill="none" stroke="#0d99ff" stroke-width="2"/>
  <path d="M236 104 l10 10 l18 -22" fill="none" stroke="#0d99ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
  },
  {
    id: 'lizenz',
    titel: { de: 'Vollversion', en: 'Full version' },
    text: {
      de: 'In der Testphase ist alles frei. Danach brauchen alle Icons bauen, Bericht und Export die Vollversion.',
      en: 'Everything is unlocked during the trial. After that, building all icons, the report and the export need the full version.'
    },
    svg: `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${GITTER}
  <rect x="52" y="92" width="72" height="56" rx="10" fill="none" stroke="#0d99ff" stroke-width="2"/>
  <path d="M70 92 v-14 a18 18 0 0 1 36 0" fill="none" stroke="#8a8a96" stroke-width="2" stroke-linecap="round"/>
  <circle cx="88" cy="118" r="6" fill="#0d99ff"/>
  <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M160 92 l7 7 l13 -14" stroke="#0d99ff"/>
    <path d="M196 96 h72" stroke="#8a8a96"/>
    <path d="M160 118 l7 7 l13 -14" stroke="#0d99ff"/>
    <path d="M196 122 h54" stroke="#8a8a96"/>
    <path d="M160 144 l7 7 l13 -14" stroke="#0d99ff"/>
    <path d="M196 148 h64" stroke="#8a8a96"/>
  </g>
</svg>`,
    extra: 'lizenz'
  }
];
