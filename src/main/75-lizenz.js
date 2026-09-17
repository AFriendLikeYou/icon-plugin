// ===========================================================================
// 75-lizenz.js — Lizenz und Testphase (Abschnitt 28.5).
//
// Grundsatz: Das Plugin sperrt niemanden aus, wenn Figma keinen Status liefert.
// `figma.payments` fehlt in älteren Figma-Versionen und ohne die Manifest-
// Berechtigung "payments" — dann gilt DEV (Dev-Build) bzw. NOT_SUPPORTED, und
// beides zählt wie bezahlt. Jeder Zugriff auf die API liegt in try/catch:
// eine geworfene Zahlungs-API darf keinen Bau verhindern.
//
// Liegt nach 70-main.js: alle Funktionen hier sind Deklarationen und damit im
// gemeinsamen Scope gehoistet; `LIZENZ` wird erst zur Nachrichtenzeit gelesen.
// ===========================================================================

const LIZENZ = {
  modell: 'einmalzahlung',
  testtage: 14,
  debugUmgehen: true,   // Dev-Build — für die Veröffentlichung auf false setzen
  kostenpflichtig: ['alle', 'bericht', 'exportieren', 'konfigImport']
};

// 'PAID' | 'UNPAID' | 'TRIAL' | null — überschreibt den echten Status, nur wenn debugUmgehen.
let LIZENZ_DEBUG = null;

const LIZENZ_STATI = ['PAID', 'UNPAID', 'TRIAL', 'NOT_SUPPORTED', 'DEV'];

// Zahlungs-API defensiv holen: fehlende Berechtigung wirft in manchen Versionen.
function lizenzZahlungen() {
  try { return figma.payments || null; } catch (e) { return null; }
}

// Sekunden seit dem ersten Start — Grundlage der Testphase.
function lizenzErstStart() {
  const p = lizenzZahlungen();
  if (!p || typeof p.getUserFirstRanSecondsAgo !== 'function') return null;
  try {
    const s = p.getUserFirstRanSecondsAgo();
    return typeof s === 'number' && isFinite(s) ? s : null;
  } catch (e) { return null; }
}

// Resttage der Testphase; null, wenn sich nichts messen lässt.
function lizenzResttage() {
  const s = lizenzErstStart();
  if (s == null) return null;
  const rest = LIZENZ.testtage * 86400 - s;
  return rest <= 0 ? 0 : Math.ceil(rest / 86400);
}

function lizenzBasis() {
  return {
    modell: LIZENZ.modell,
    testtage: LIZENZ.testtage,
    kostenpflichtig: LIZENZ.kostenpflichtig.slice(),
    debug: !!LIZENZ.debugUmgehen
  };
}

function lizenzStatus() {
  const basis = lizenzBasis();

  // Entwicklermodus schlägt alles — aber nur im Dev-Build.
  if (LIZENZ.debugUmgehen && LIZENZ_DEBUG) {
    const rest = LIZENZ_DEBUG === 'TRIAL'
      ? (lizenzResttage() == null ? LIZENZ.testtage : lizenzResttage())
      : null;
    return Object.assign(basis, { status: LIZENZ_DEBUG, resttage: rest });
  }

  const p = lizenzZahlungen();
  let typ = null;
  if (p) { try { typ = (p.status && p.status.type) || null; } catch (e) { typ = null; } }

  // Kein Status ermittelbar → freischalten, nicht aussperren.
  if (!typ) return Object.assign(basis, {
    status: LIZENZ.debugUmgehen ? 'DEV' : 'NOT_SUPPORTED',
    resttage: null
  });

  if (typ === 'PAID') return Object.assign(basis, { status: 'PAID', resttage: null });

  // UNPAID: läuft die Testphase noch?
  const rest = lizenzResttage();
  if (rest == null) return Object.assign(basis, { status: 'TRIAL', resttage: null });  // Zeit unbekannt → Testphase
  if (rest > 0) return Object.assign(basis, { status: 'TRIAL', resttage: rest });
  return Object.assign(basis, { status: 'UNPAID', resttage: 0 });
}

// Zählt dieser Status als freigeschaltet? Nur ein sicher erkanntes UNPAID sperrt.
function lizenzFrei(status) {
  return status !== 'UNPAID';
}

// Lesbarer Name einer kostenpflichtigen Funktion; unbekannte Schlüssel bleiben roh.
function lizenzFunktionName(funktion) {
  const k = 'lizenz.funktion.' + funktion;
  const s = t(k);
  return s === k ? String(funktion) : s;
}

// Wirft PipelineFehler('LIZENZ_NOETIG'), wenn die Funktion Geld kostet und
// der Status sicher UNPAID ist. Async, weil der Aufrufer ohnehin await nutzt
// und eine spätere Status-Abfrage asynchron werden darf.
async function lizenzPruefen(funktion) {
  const s = lizenzStatus();
  if (LIZENZ.kostenpflichtig.indexOf(funktion) < 0) return s;
  if (!lizenzFrei(s.status))
    throw new PipelineFehler('LIZENZ_NOETIG', {
      funktion: lizenzFunktionName(funktion),
      tage: LIZENZ.testtage
    });
  return s;
}

// Status an die UI schicken (Kopf-Chip, Einstellungen, Paywall-Dialog).
function lizenzSenden() {
  const s = lizenzStatus();
  ui(Object.assign({ type: 'lizenz' }, s));
  return s;
}

// Kauf anstoßen. Das Interstitial ist Figmas eigener Dialog; er darf hängen
// oder abbrechen, ohne die UI zu blockieren — darum try/catch und danach
// unabhängig vom Ausgang den Status neu melden.
async function lizenzKaufen(grund) {
  const p = lizenzZahlungen();
  const interstitial = grund === 'TRIAL_ENDED' ? 'TRIAL_ENDED' : 'PAID_FEATURE';
  if (!p || typeof p.initiateCheckoutAsync !== 'function') {
    logZeile('info', t('lizenz.keinKauf'), null, { schwere: 'info' });
    return lizenzStatus();
  }
  try {
    await p.initiateCheckoutAsync({ interstitial: interstitial });
  } catch (e) {
    logZeile('warn', t('lizenz.kaufFehler', { grund: (e && e.message) || String(e) }),
      null, { schwere: 'warnung' });
  }
  return lizenzStatus();
}

// Entwicklermodus: Status lokal umschalten. Ohne debugUmgehen passiert nichts.
async function lizenzDebugSetzen(status) {
  if (!LIZENZ.debugUmgehen) return lizenzStatus();
  LIZENZ_DEBUG = LIZENZ_STATI.indexOf(status) >= 0 ? status : null;

  const p = lizenzZahlungen();
  // setPaymentStatusInDevelopment kennt nur PAID/UNPAID — TRIAL bilden wir
  // über UNPAID plus LIZENZ_DEBUG ab.
  const echt = LIZENZ_DEBUG === 'PAID' ? 'PAID' : (LIZENZ_DEBUG ? 'UNPAID' : null);
  if (p && echt && typeof p.setPaymentStatusInDevelopment === 'function') {
    try { p.setPaymentStatusInDevelopment({ type: echt }); } catch (e) {}
  }
  logZeile('info', t('lizenz.debugGesetzt', { status: LIZENZ_DEBUG || '—' }), null, { schwere: 'info' });
  return lizenzStatus();
}
