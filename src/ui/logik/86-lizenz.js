  // =========================================================================
  // Lizenz — Kopf-Chip, Einstellungen-Block, vollflächiger Lizenz-Screen
  // =========================================================================
  let LIZENZ = null;                 // { status, resttage, debug, modell, kostenpflichtig }
  let paywallGezeigtSitzung = false; // nur im Speicher, nicht im clientStorage
  let paywallGrund = 'TRIAL_ENDED', paywallFunktion = '', paywallLogText = '';

  function lizenzVoll() {
    const s = LIZENZ && LIZENZ.status;
    return s === 'PAID' || s === 'DEV' || s === 'NOT_SUPPORTED';
  }
  function lizenzTitel() {
    if (!LIZENZ) return t('liz.unbekannt');
    if (LIZENZ.status === 'DEV') return t('liz.dev');
    if (lizenzVoll()) return t('liz.voll');
    if (LIZENZ.status === 'TRIAL') return t('liz.test', { tage: LIZENZ.resttage == null ? '?' : LIZENZ.resttage });
    return t('liz.frei');
  }
  function lizenzFunktionName(f) {
    const k = 'liz.fn.' + f;
    const txt = t(k);
    return txt === k ? f : txt;
  }
  function lizenzUmfangText() {
    const liste = ((LIZENZ && LIZENZ.kostenpflichtig) || ['alle', 'bericht', 'exportieren', 'konfigImport'])
      .map(lizenzFunktionName).join(', ');
    return t('liz.umfang', { liste: liste });
  }

  function lizenzZeichnen() {
    const chip = $('lizenzChip');
    if (chip) {
      chip.textContent = LIZENZ ? lizenzTitel() : '';
      chip.className = 'chip lizchip' + (LIZENZ ? ' an' : '')
        + (!LIZENZ ? '' : lizenzVoll() ? ' voll' : LIZENZ.status === 'TRIAL' ? ' test' : ' aus');
    }
    const karteChip = $('lizStatusChip');
    if (karteChip) {
      karteChip.className = 'chip grau';
      karteChip.textContent = lizenzTitel();
    }
    if ($('lizModell')) $('lizModell').textContent = t('liz.modellEinmal');
    if ($('lizUmfang')) $('lizUmfang').textContent = lizenzUmfangText();
    if ($('lizHinweis')) $('lizHinweis').textContent = t('liz.pwHinweis');
    const kauf = $('btnLizKaufen');
    if (kauf) { kauf.hidden = lizenzVoll(); kauf.textContent = t('liz.kaufen'); }
    const dbg = $('lizDebug');
    if (dbg) {
      dbg.hidden = !(LIZENZ && LIZENZ.debug);
      if (LIZENZ && LIZENZ.debug && LIZENZ.status !== 'DEV') wert($('segLizDebug'), LIZENZ.status);
    }
  }

  // ---- Lizenz-Screen (überlagert das Panel) -------------------------------
  function lizenzSkizze() {
    const m = (cfgLokal && cfgLokal.master)
      || { groesse: 72, keylines: { Square: 56, Circular: 60, Wide: 64, Tall: 64 } };
    return '<div class="marke-gross">' + keylineSvg(m.groesse, m.keylines, 64) + '</div>'
      + '<div class="skizze"><span class="bunt">' + esc(t('titel')) + '</span></div>';
  }
  function paywallZeichnen() {
    $('pwBild').innerHTML = lizenzSkizze();
    const trial = LIZENZ && LIZENZ.status === 'TRIAL';
    if (paywallGrund === 'PAID_FEATURE') {
      $('pwTitel').textContent = t('liz.pwTitelFn');
      // Der Hauptthread schickt den Funktionsnamen im Log-Text mit; ohne
      // eigenes Feld nehmen wir diesen Text als Erklärung.
      $('pwText').textContent = paywallFunktion
        ? t('liz.pwTextFn', { funktion: paywallFunktion })
        : (paywallLogText || t('liz.pwTextAus'));
    } else if (trial) {
      $('pwTitel').textContent = t('liz.pwTitelTrial', { tage: LIZENZ.resttage == null ? '?' : LIZENZ.resttage });
      $('pwText').textContent = t('liz.pwTextTrial');
    } else {
      $('pwTitel').textContent = t('liz.pwTitelAus');
      $('pwText').textContent = t('liz.pwTextAus');
    }
    $('pwKaufen').textContent = trial ? t('liz.pwKaufenTrial') : t('liz.pwKaufenAus');
    $('pwSpaeter').textContent = trial ? t('liz.pwSpaeterTrial') : t('liz.pwSpaeterAus');
    $('pwHinweisText').textContent = t('liz.pwHinweis');
  }
  function paywallZeigen(grund, funktion, logText) {
    paywallGrund = grund || 'TRIAL_ENDED';
    paywallFunktion = funktion || '';
    paywallLogText = logText || '';
    paywallZeichnen();
    dialogAuf('dlgPaywall');
  }
  $('pwZu').addEventListener('click', () => dialogZu('dlgPaywall'));
  $('pwSpaeter').addEventListener('click', () => dialogZu('dlgPaywall'));
  $('pwKaufen').addEventListener('click', () => {
    dialogZu('dlgPaywall');
    send({ type: 'lizenzKaufen', grund: paywallGrund === 'PAID_FEATURE' ? 'PAID_FEATURE' : 'TRIAL_ENDED' });
  });
  $('btnLizKaufen').addEventListener('click', () => send({ type: 'lizenzKaufen', grund: 'PAID_FEATURE' }));
  // Kauf auf einem anderen Gerät: Status neu vom Figma-Konto holen.
  $('btnLizStatus').addEventListener('click', () => { send({ type: 'lizenzStatus' }); toast(t('toast.lizStatus')); });
  $('segLizDebug').addEventListener('change', e => {
    const v = (e && e.detail) || $('segLizDebug').value;
    if (v) send({ type: 'lizenzDebug', status: v });
  });

  // ---- Nachrichten --------------------------------------------------------
  function lizenzUebernehmen(l) {
    if (!l) return;
    LIZENZ = l;
    lizenzZeichnen();
    paywallStartPruefen();
  }
  // Einmal je Sitzung: wer nicht gekauft hat, sieht den Screen beim Start —
  // aber erst, wenn der Rundgang durch ist (sonst liegen zwei Dialoge übereinander).
  function paywallStartPruefen() {
    if (paywallGezeigtSitzung) return;
    if (obOffen || onboardingGesehen !== true) return;
    if (!LIZENZ || LIZENZ.status !== 'UNPAID') return;
    paywallGezeigtSitzung = true;
    paywallZeigen('TRIAL_ENDED', '');
  }
  bei('lizenz', m => lizenzUebernehmen(m));
  bei('konfig', m => { if (m && m.lizenz) lizenzUebernehmen(m.lizenz); });
  bei('log', m => {
    if (!m || m.code !== 'LIZENZ_NOETIG') return;
    const txt = [m.text, m.hinweis].filter(Boolean).join(' ');
    paywallZeigen('PAID_FEATURE', m.funktion ? lizenzFunktionName(m.funktion) : '', txt);
  });

  send({ type: 'lizenzStatus' });
